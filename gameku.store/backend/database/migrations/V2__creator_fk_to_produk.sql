-- ============================================================
-- V2__creator_fk_to_produk.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: idempoten via guard INFORMATION_SCHEMA. Run kedua = no-op.
-- Prinsip: additive only. Kolom string `creator` DIPERTAHANKAN
--   (dual-write backend: tulis keduanya; baca creator_id dulu,
--   fallback creator). TIDAK ada DROP kolom di file ini.
-- Perbaikan dari review:
--   F-V2-01: ADD COLUMN/FK memakai guard.
--   F-V2-02: backfill HANYA via id eksak + nama (UNIQUE), TANPA username
--     (username tidak UNIQUE, boleh kosong -> nondeterministik).
--     Baris ambigu dibiarkan NULL untuk kurasi manual.
--   F-V2-03: laporan orfan + tak-cocok via SELECT (tanpa mengubah data).
--   F-V2-04: tegaskan kolom lama tidak di-drop tahap ini.
-- Urutan: JALANKAN SETELAH V1. ADD FK paling akhir setelah orfan = 0.
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

DROP PROCEDURE IF EXISTS `__v2_tambah_kolom_produk`;
DROP PROCEDURE IF EXISTS `__v2_tambah_fk_produk`;
DROP PROCEDURE IF EXISTS `__v2_tambah_index_produk`;

DELIMITER $$

CREATE PROCEDURE `__v2_tambah_kolom_produk`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'produk'
      AND COLUMN_NAME = 'creator_id'
  ) THEN
    ALTER TABLE `produk`
      ADD COLUMN `creator_id` VARCHAR(40) NULL DEFAULT NULL
      COMMENT 'FK ke creator.id; NULL = belum dipetakan'
      AFTER `creator`;
  END IF;
END$$

CREATE PROCEDURE `__v2_tambah_index_produk`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'produk'
      AND INDEX_NAME = 'idx_produk_creator'
  ) THEN
    ALTER TABLE `produk`
      ADD INDEX `idx_produk_creator` (`creator_id`);
  END IF;
END$$

CREATE PROCEDURE `__v2_tambah_fk_produk`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'produk'
      AND CONSTRAINT_NAME = 'fk_produk_creator'
  ) THEN
    ALTER TABLE `produk`
      ADD CONSTRAINT `fk_produk_creator`
      FOREIGN KEY (`creator_id`) REFERENCES `creator` (`id`)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$

DELIMITER ;

-- 1. Kolom baru (non-destruktif)
CALL `__v2_tambah_kolom_produk`();

-- 2. Backfill deterministik: hanya id eksak atau nama (UNIQUE di creator).
--    Sengaja TANPA username (tidak UNIQUE). Hanya baris creator_id NULL.
UPDATE `produk` p
SET p.`creator_id` = (
  SELECT c.`id` FROM `creator` c
  WHERE c.`id` = p.`creator`
  LIMIT 1
)
WHERE p.`creator_id` IS NULL
  AND p.`creator` <> ''
  AND EXISTS (SELECT 1 FROM `creator` c WHERE c.`id` = p.`creator`);

UPDATE `produk` p
SET p.`creator_id` = (
  SELECT c.`id` FROM `creator` c
  WHERE c.`nama` = p.`creator`
  LIMIT 1
)
WHERE p.`creator_id` IS NULL
  AND p.`creator` <> ''
  AND EXISTS (SELECT 1 FROM `creator` c WHERE c.`nama` = p.`creator`);

-- 3. Laporan validasi (SELECT saja; penguji menjalankan manual di salinan):
-- 3a. Baris belum terpetakan (kurasi manual, JANGAN ditebak):
-- SELECT id, creator FROM produk WHERE creator_id IS NULL AND creator <> '';
-- 3b. Orfan (harus 0 sebelum ADD FK):
-- SELECT COUNT(*) AS orfan FROM produk
--   WHERE creator_id IS NOT NULL
--   AND creator_id NOT IN (SELECT id FROM creator);

-- 4. Index lookup creator_id
CALL `__v2_tambah_index_produk`();

-- 5. FK SET NULL (produk tetap ada bila creator dihapus; kolom string lama
--    tetap terbaca sebagai fallback)
CALL `__v2_tambah_fk_produk`();

-- 6. Bersih-bersih
DROP PROCEDURE IF EXISTS `__v2_tambah_kolom_produk`;
DROP PROCEDURE IF EXISTS `__v2_tambah_fk_produk`;
DROP PROCEDURE IF EXISTS `__v2_tambah_index_produk`;

-- CATATAN: JANGAN drop kolom `creator` di tahap ini.