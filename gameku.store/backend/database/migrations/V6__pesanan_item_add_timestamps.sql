-- ============================================================
-- V6__pesanan_item_add_timestamps.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: idempoten via guard INFORMATION_SCHEMA. UPDATE backfill memakai
--   WHERE ... IS NULL sehingga run kedua = no-op.
-- Perbaikan dari review:
--   F-V6-01: TIDAK ada UPDATE ke kolom yang tidak ada (bug dibuat_pana).
--   F-V6-02: ejaan baku dibuat_pada/diperbarui_pada.
--   F-V6-03: ADD COLUMN memakai guard; ADD INDEX memakai guard.
--   F-V6-04: backfill dari INDUK pesanan.dibuat_pada (aproksimasi yang
--     didokumentasikan: item dibuat bersama pesanan). Bukan waktu migrasi.
-- Urutan: JALANKAN SETELAH V1–V5 (tidak ada dependensi FK, boleh kapan saja
--   setelah skema dasar ada).
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

DROP PROCEDURE IF EXISTS `__v6_tambah_kolom_item`;
DROP PROCEDURE IF EXISTS `__v6_tambah_index_item`;

DELIMITER $$

CREATE PROCEDURE `__v6_tambah_kolom_item`(
  IN p_nama_kolom VARCHAR(64),
  IN p_definisi TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pesanan_item'
      AND COLUMN_NAME = p_nama_kolom
  ) THEN
    SET @__v6_sql = CONCAT(
      'ALTER TABLE `pesanan_item` ADD COLUMN `', p_nama_kolom, '` ', p_definisi
    );
    PREPARE __v6_stmt FROM @__v6_sql;
    EXECUTE __v6_stmt;
    DEALLOCATE PREPARE __v6_stmt;
  END IF;
END$$

CREATE PROCEDURE `__v6_tambah_index_item`(
  IN p_nama_index VARCHAR(64),
  IN p_definisi_kolom VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pesanan_item'
      AND INDEX_NAME = p_nama_index
  ) THEN
    SET @__v6_sql = CONCAT(
      'ALTER TABLE `pesanan_item` ADD INDEX `', p_nama_index, '` (', p_definisi_kolom, ')'
    );
    PREPARE __v6_stmt FROM @__v6_sql;
    EXECUTE __v6_stmt;
    DEALLOCATE PREPARE __v6_stmt;
  END IF;
END$$

DELIMITER ;

-- 1. Kolom timestamp (NULL-able; baris lama diisi dari induk di langkah 2)
CALL `__v6_tambah_kolom_item`(
  'dibuat_pada',
  'DATETIME NULL DEFAULT NULL COMMENT \'aproksimasi dari pesanan induk\' AFTER `subtotal`'
);
CALL `__v6_tambah_kolom_item`(
  'diperbarui_pada',
  'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `dibuat_pada`'
);

-- 2. Backfill dari induk (hanya yang masih NULL; idempoten)
UPDATE `pesanan_item` pi
JOIN `pesanan` p ON p.`id` = pi.`pesanan_id`
SET pi.`dibuat_pada` = p.`dibuat_pada`
WHERE pi.`dibuat_pada` IS NULL;

-- 3. Index laporan per waktu
CALL `__v6_tambah_index_item`('idx_pesanan_item_dibuat', '`dibuat_pada`');

-- 4. Bersih-bersih
DROP PROCEDURE IF EXISTS `__v6_tambah_kolom_item`;
DROP PROCEDURE IF EXISTS `__v6_tambah_index_item`;
