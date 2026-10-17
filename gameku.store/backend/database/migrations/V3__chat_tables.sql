-- ============================================================
-- V3__chat_tables.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: CREATE TABLE IF NOT EXISTS + ALTER guard untuk kolom/index
--   susulan. Run kedua = no-op bila definisi sudah sesuai.
--   Verifikasi pasca-run via INFORMATION_SCHEMA (IF NOT EXISTS tidak
--   mendeteksi definisi usang).
-- Perbaikan dari review:
--   F-V3-01: ejaan baku diperbarui_pada.
--   F-V3-02: identitas polimorfik (user_tipe + user_id, TANPA FK tunggal).
--     Alasan: anggota bisa pelanggan/creator/admin; satu FK ke pelanggan
--     akan menolak dua peran lain. Otorisasi di lapisan aplikasi.
--   F-V3-03: dokumentasi isolasi + kolom baca per-anggota.
--   F-V3-04: index pagination (percakunan_id, dikirim_pada, id).
--   F-V3-05: catatan verifikasi definisi.
-- Prinsip: tidak ada duplikasi pesan per penerima; satu baris pesan,
--   status baca dicatat per anggota di pesan_baca.
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

-- 3.1 Percakapan (pribadi/grup; grup bila anggota > 2 di aplikasi)
CREATE TABLE IF NOT EXISTS `percakapan` (
  `id`              VARCHAR(40)  NOT NULL,
  `tipe`            VARCHAR(20)  NOT NULL DEFAULT 'Pribadi' COMMENT 'Pribadi|Grup|Dukungan',
  `judul`           VARCHAR(200) NOT NULL DEFAULT '',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'Aktif' COMMENT 'Aktif|Tutup|Arsip',
  `pesan_terakhir_id` VARCHAR(40) NULL DEFAULT NULL COMMENT 'denormalisasi opsional',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_percakapan_status` (`status`),
  KEY `idx_percakapan_dibuat` (`dibuat_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.2 Anggota percakapan (satu baris per (percakapan, tipe, user))
CREATE TABLE IF NOT EXISTS `anggota_percakapan` (
  `id`              VARCHAR(40) NOT NULL,
  `percakapan_id`   VARCHAR(40) NOT NULL,
  `user_tipe`       VARCHAR(20) NOT NULL COMMENT 'pelanggan|creator|admin',
  `user_id`         VARCHAR(40) NOT NULL COMMENT 'id sesuai user_tipe; admin int disimpan string',
  `peran`           VARCHAR(20) NOT NULL DEFAULT 'Anggota' COMMENT 'Anggota|Moderator|Pengelola',
  `bergabung_pada`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `keluar_pada`     DATETIME NULL DEFAULT NULL COMMENT 'NULL = masih anggota',
  `terakhir_baca_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_anggota` (`percakapan_id`, `user_tipe`, `user_id`),
  KEY `idx_anggota_user` (`user_tipe`, `user_id`),
  CONSTRAINT `fk_anggota_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- 3.3 Pesan (satu baris per pesan; TANPA duplikasi per penerima)
CREATE TABLE IF NOT EXISTS `pesan` (
  `id`              VARCHAR(40) NOT NULL,
  `percakapan_id`   VARCHAR(40) NOT NULL,
  `pengirim_tipe`   VARCHAR(20) NOT NULL COMMENT 'pelanggan|creator|admin',
  `pengirim_id`     VARCHAR(40) NOT NULL,
  `teks`            TEXT NULL,
  `tipe`            VARCHAR(20) NOT NULL DEFAULT 'teks' COMMENT 'teks|gambar|file|sistem',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada`     DATETIME NULL DEFAULT NULL COMMENT 'edit pesan',
  `dihapus_pada`    DATETIME NULL DEFAULT NULL COMMENT 'hapus logis; NULL=aktif',
  PRIMARY KEY (`id`),
  KEY `idx_pesan_percakapan_kirim` (`percakapan_id`, `dibuat_pada`, `id`),
  KEY `idx_pesan_pengirim` (`pengirim_tipe`, `pengirim_id`),
  CONSTRAINT `fk_pesan_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.4 Lampiran pesan via media (banyak lampiran per pesan, tanpa duplikat pesan)
CREATE TABLE IF NOT EXISTS `pesan_lampiran` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pesan_id`      VARCHAR(40) NOT NULL,
  `media_id`      VARCHAR(40) NOT NULL,
  `dibuat_pada`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pesan_media` (`pesan_id`, `media_id`),
  KEY `idx_lampiran_media` (`media_id`),
  CONSTRAINT `fk_lampiran_pesan`
    FOREIGN KEY (`pesan_id`) REFERENCES `pesan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lampiran_media`
    FOREIGN KEY (`media_id`) REFERENCES `media` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.5 Status baca per anggota (mendukung grup; tanpa kolom dibaca_pada tunggal)
CREATE TABLE IF NOT EXISTS `pesan_baca` (
  `pesan_id`        VARCHAR(40) NOT NULL,
  `user_tipe`       VARCHAR(20) NOT NULL,
  `user_id`         VARCHAR(40) NOT NULL,
  `dibaca_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pesan_id`, `user_tipe`, `user_id`),
  KEY `idx_baca_user` (`user_tipe`, `user_id`, `dibaca_pada`),
  CONSTRAINT `fk_baca_pesan`
    FOREIGN KEY (`pesan_id`) REFERENCES `pesan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.6 Alias kompatibilitas draf lama (opsional, hanya bila backend lama
--     memakai nama percakunan/anggota_peserta; VIEW tanpa data ganda).
--     Hapus blok ini bila backend sudah memakai nama baru.
CREATE OR REPLACE VIEW `percakapan_view` AS
  SELECT `id`, `judul`, `status`, `dibuat_pada`, `diperbarui_pada`
  FROM `percakapan`;

-- ISOLASI (wajib di aplikasi, bukan hanya FK):
--   SELECT/INSERT pesan HANYA bila (percakapan_id,user_tipe,user_id) ada di
--   anggota_percakapan dengan keluar_pada IS NULL.
--   Contoh cek: SELECT 1 FROM anggota_percakapan
--     WHERE percakapan_id=? AND user_tipe=? AND user_id=? AND keluar_pada IS NULL.
-- PAGINATION: WHERE percakapan_id=? AND (dibuat_pada,id) < (?,?)
--   ORDER BY dibuat_pada DESC, id DESC LIMIT ? memakai idx_pesan_percakapan_kirim.
