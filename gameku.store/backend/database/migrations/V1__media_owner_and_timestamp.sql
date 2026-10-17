-- ============================================================
-- V1__media_owner_and_timestamp.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: idempoten via guard INFORMATION_SCHEMA + prosedur sekali-pakai.
--   Run kedua = no-op (tidak galat).
--   DDL implicit-commit: jalankan HANYA di DB hasil backup, satu file
--   per langkah, verifikasi INFORMATION_SCHEMA sesudahnya.
-- Prinsip: additive only. Tidak ada DROP/TRUNCATE/DELETE data.
-- Rollback: restore backup (disarankan).
-- Perbaikan dari review:
--   F-V1-01: UPDATE memakai kolom benar (dibuat_pada).
--   F-V1-02: ejaan baku dibuat_pada/diperbarui_pada.
--   F-V1-03: semua ADD COLUMN/INDEX memakai guard.
--   F-V1-04: kolom baru NULL-able dulu, backfill, tanpa kunci waktu migrasi.
--   F-V1-05: owner polimorfik eksplisit (owner_tipe + owner_id, TANPA FK).
-- Kompatibilitas: kolom `tanggal` lama DIPERTAHANKAN.
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

-- 0. Prosedur bantu sekali-pakai (dibuat ulang tiap run, dihapus akhir)
DROP PROCEDURE IF EXISTS `__v1_tambah_kolom_media`;
DROP PROCEDURE IF EXISTS `__v1_tambah_index_media`;

DELIMITER $$

CREATE PROCEDURE `__v1_tambah_kolom_media`(
  IN p_nama_kolom VARCHAR(64),
  IN p_definisi TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media'
      AND COLUMN_NAME = p_nama_kolom
  ) THEN
    SET @__v1_sql = CONCAT(
      'ALTER TABLE `media` ADD COLUMN `', p_nama_kolom, '` ', p_definisi
    );
    PREPARE __v1_stmt FROM @__v1_sql;
    EXECUTE __v1_stmt;
    DEALLOCATE PREPARE __v1_stmt;
  END IF;
END$$

CREATE PROCEDURE `__v1_tambah_index_media`(
  IN p_nama_index VARCHAR(64),
  IN p_definisi_kolom VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media'
      AND INDEX_NAME = p_nama_index
  ) THEN
    SET @__v1_sql = CONCAT(
      'ALTER TABLE `media` ADD INDEX `', p_nama_index, '` (', p_definisi_kolom, ')'
    );
    PREPARE __v1_stmt FROM @__v1_sql;
    EXECUTE __v1_stmt;
    DEALLOCATE PREPARE __v1_stmt;
  END IF;
-- 1. Tambah kolom baru (NULL-able dulu agar baris lama aman)
CALL `__v1_tambah_kolom_media`(
  'owner_tipe',
  'VARCHAR(20) NULL DEFAULT NULL COMMENT \'pelanggan|creator|admin\' AFTER `id`'
);
CALL `__v1_tambah_kolom_media`(
  'owner_id',
  'VARCHAR(40) NULL DEFAULT NULL COMMENT \'id pemilik; tanpa FK (polimorfik)\' AFTER `owner_tipe`'
);
CALL `__v1_tambah_kolom_media`(
  'nama_asli',
  'VARCHAR(200) NULL DEFAULT NULL COMMENT \'nama file asli saat diunggah\' AFTER `nama`'
);
CALL `__v1_tambah_kolom_media`(
  'nama_simpan',
  'VARCHAR(255) NULL DEFAULT NULL COMMENT \'nama file di storage\' AFTER `nama_asli`'
);
CALL `__v1_tambah_kolom_media`(
  'object_key',
  'VARCHAR(255) NULL DEFAULT NULL COMMENT \'lokasi/object key storage\' AFTER `url`'
);
CALL `__v1_tambah_kolom_media`(
  'ekstensi',
  'VARCHAR(20) NULL DEFAULT NULL COMMENT \'ekstensi tanpa titik\' AFTER `mime`'
);
CALL `__v1_tambah_kolom_media`(
  'checksum',
  'VARCHAR(64) NULL DEFAULT NULL COMMENT \'sha256 hex; bukan isi file\' AFTER `ukuran`'
);
CALL `__v1_tambah_kolom_media`(
  'status',
  'VARCHAR(20) NOT NULL DEFAULT \'Aktif\' COMMENT \'Aktif|Dihapus\' AFTER `checksum`'
);
CALL `__v1_tambah_kolom_media`(
  'dibuat_pada',
  'DATETIME NULL DEFAULT NULL COMMENT \'waktu unggah dari tanggal lama\' AFTER `object_key`'
);
CALL `__v1_tambah_kolom_media`(
  'diperbarui_pada',
  'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `dibuat_pada`'
);
CALL `__v1_tambah_kolom_media`(
  'dihapus_pada',
  'DATETIME NULL DEFAULT NULL COMMENT \'hapus logis; NULL=aktif\' AFTER `diperbarui_pada`'
);

-- 2. Backfill: salin tanggal lama ke dibuat_pada (hanya yang masih NULL)
UPDATE `media`
SET `dibuat_pada` = `tanggal`
WHERE `dibuat_pada` IS NULL
  AND `tanggal` IS NOT NULL;

-- 3. Index (guard; aman dijalankan ulang)
CALL `__v1_tambah_index_media`('idx_media_owner', '`owner_tipe`, `owner_id`');
CALL `__v1_tambah_index_media`('idx_media_owner_jenis', '`owner_tipe`, `owner_id`, `jenis`');
CALL `__v1_tambah_index_media`('idx_media_dibuat', '`dibuat_pada`');
CALL `__v1_tambah_index_media`('idx_media_status', '`status`');

-- 4. CHECK ukuran >= 0 (guard; diabaikan 5.7, ditegakkan 10.2+/8.0.16+)
DROP PROCEDURE IF EXISTS `__v1_tambah_check_media`;
DELIMITER $$
CREATE PROCEDURE `__v1_tambah_check_media`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media'
      AND CONSTRAINT_NAME = 'chk_media_ukuran'
  ) THEN
    ALTER TABLE `media`
      ADD CONSTRAINT `chk_media_ukuran` CHECK (`ukuran` >= 0);
  END IF;
END$$
DELIMITER ;
CALL `__v1_tambah_check_media`();

-- 5. Bersih-bersih prosedur bantu (DROP IF EXISTS = idempoten)
DROP PROCEDURE IF EXISTS `__v1_tambah_kolom_media`;
DROP PROCEDURE IF EXISTS `__v1_tambah_index_media`;
DROP PROCEDURE IF EXISTS `__v1_tambah_check_media`;

-- CATATAN: kolom `tanggal` SENGAJA dipertahankan untuk backend lama.
-- Hapus hanya setelah backend membaca dibuat_pada (migrasi terpisah).
END$$

DELIMITER ;
