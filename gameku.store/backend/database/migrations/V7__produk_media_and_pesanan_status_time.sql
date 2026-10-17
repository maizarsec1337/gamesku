-- ============================================================
-- V7__produk_media_and_pesanan_status_time.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: CREATE TABLE IF NOT EXISTS + guard INFORMATION_SCHEMA. No-op bila
--   dijalankan ulang.
-- Isi:
--   A. Tabel `produk_media` (banyak foto per produk; modul D).
--   B. Kolom `dibatalkan_pada` + `diselesaikan_pada` di `pesanan` (modul F).
-- Keputusan penjual (modul F): TIDAK ada kolom `penjual_id` di `pesanan`
--   karena tidak ada tabel akun penjual — penjual = creator produk yang
--   diturunkan via join (contoh di bawah). Ini menghindari kolom duplikat
--   dan FK ke tabel yang salah.
--     SELECT cr.* FROM pesanan ps
--     JOIN pesanan_item pi ON pi.pesanan_id = ps.id
--     JOIN produk pr ON pr.id = pi.produk_id
--     JOIN creator cr ON cr.id = pr.creator_id
--     WHERE ps.id = ?;
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

-- A. Relasi banyak-media per produk (thumbnail utama tetap di produk.thumbnail)
CREATE TABLE IF NOT EXISTS `produk_media` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `produk_id`       VARCHAR(40) NOT NULL,
  `media_id`        VARCHAR(40) NOT NULL,
  `urutan`          INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'urutan tampil galeri',
  `peran`           VARCHAR(30) NOT NULL DEFAULT 'galeri' COMMENT 'galeri|thumbnail|preview|file',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_produk_media` (`produk_id`, `media_id`),
  KEY `idx_produk_media_urut` (`produk_id`, `urutan`),
  KEY `idx_produk_media_media` (`media_id`),
  CONSTRAINT `fk_produk_media_produk`
    FOREIGN KEY (`produk_id`) REFERENCES `produk` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_produk_media_media`
    FOREIGN KEY (`media_id`) REFERENCES `media` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- B. Waktu batal/selesai pesanan (dibuat/diubah sudah ada di skema dasar)
DROP PROCEDURE IF EXISTS `__v7_tambah_kolom_pesanan`;

DELIMITER $$

CREATE PROCEDURE `__v7_tambah_kolom_pesanan`(
  IN p_nama_kolom VARCHAR(64),
  IN p_definisi TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pesanan'
      AND COLUMN_NAME = p_nama_kolom
  ) THEN
    SET @__v7_sql = CONCAT(
      'ALTER TABLE `pesanan` ADD COLUMN `', p_nama_kolom, '` ', p_definisi
    );
    PREPARE __v7_stmt FROM @__v7_sql;
    EXECUTE __v7_stmt;
    DEALLOCATE PREPARE __v7_stmt;
  END IF;
END$$

DELIMITER ;

CALL `__v7_tambah_kolom_pesanan`(
  'dibatalkan_pada',
  'DATETIME NULL DEFAULT NULL COMMENT \'NULL = belum/tidak dibatalkan\' AFTER `diperbarui_pada`'
);
CALL `__v7_tambah_kolom_pesanan`(
  'diselesaikan_pada',
  'DATETIME NULL DEFAULT NULL COMMENT \'NULL = belum selesai\' AFTER `dibatalkan_pada`'
);

DROP PROCEDURE IF EXISTS `__v7_tambah_kolom_pesanan`;

-- ATURAN STATUS PESANAN (ditegakkan aplikasi):
--   Menunggu -> Diproses | Gagal
--   Diproses -> Berhasil | Gagal
--   Berhasil/Gagal = final. Saat Gagal: isi dibatalkan_pada.
--   Saat Berhasil: isi diselesaikan_pada.
