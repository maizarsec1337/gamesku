
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- PENGGUNA
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pengguna` VARCHAR(60) NOT NULL,
  `nama` VARCHAR(120) NOT NULL DEFAULT '',
  `email` VARCHAR(150) NOT NULL DEFAULT '',
  `sandi_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `peran` VARCHAR(20) NOT NULL DEFAULT 'admin',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `masuk_terakhir` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_pengguna` (`pengguna`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pelanggan` (
  `id` VARCHAR(40) NOT NULL,
  `nama` VARCHAR(120) NOT NULL DEFAULT '',
  `username` VARCHAR(60) NOT NULL DEFAULT '',
  `email` VARCHAR(150) NOT NULL,
  `sandi_hash` VARCHAR(255) NULL DEFAULT NULL,
  `total_beli` BIGINT NOT NULL DEFAULT 0,
  `jumlah_pesanan` INT NOT NULL DEFAULT 0,
  `bergabung` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pelanggan_email` (`email`),
  KEY `idx_pelanggan_username` (`username`),
  KEY `idx_pelanggan_status_bergabung` (`status`, `bergabung`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `creator` (
  `id` VARCHAR(40) NOT NULL,
  `nama` VARCHAR(120) NOT NULL,
  `username` VARCHAR(60) NOT NULL DEFAULT '',
  `produk` INT NOT NULL DEFAULT 0,
  `penjualan` INT NOT NULL DEFAULT 0,
  `pendapatan` BIGINT NOT NULL DEFAULT 0,
  `bergabung` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Aktif','Review','Ditangguhkan') NOT NULL DEFAULT 'Review',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_creator_nama` (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RESELLER: pengajuan reseller oleh pelanggan. Identitas pemohon diambil
-- dari sesi backend (bukan user_id dari request). Satu pelanggan tidak boleh
-- memiliki pengajuan pending/approved secara bersamaan (unik per status).
CREATE TABLE IF NOT EXISTS `reseller_pengajuan` (
  `id` VARCHAR(40) NOT NULL,
  `pelanggan_id` VARCHAR(40) NOT NULL,
  `admin_id` INT UNSIGNED NULL DEFAULT NULL,
  `nama` VARCHAR(120) NOT NULL DEFAULT '',
  `email` VARCHAR(150) NOT NULL DEFAULT '',
  `username` VARCHAR(60) NOT NULL DEFAULT '',
  `whatsapp` VARCHAR(40) NOT NULL DEFAULT '',
  `catatan` VARCHAR(500) NOT NULL DEFAULT '',
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `alasan_penolakan` VARCHAR(500) NOT NULL DEFAULT '',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- Kolom generated: 1 bila masih ada pengajuan aktif (pending/approved),
  -- NULL bila final (rejected). MySQL tidak mendukung operator ternary `? :`
  -- di generated column, pakai IF(). Unique (pelanggan_id, aktif) mencegah
  -- duplikat pending/approved; rejected berulang diperbolehkan karena NULL
  -- tidak bertentangan pada unique key di MySQL (banyak NULL = tidak duplikat).
  `aktif` TINYINT AS (IF(status IN ('pending','approved'),1,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_reseller_pelanggan_aktif` (`pelanggan_id`, `aktif`),
  KEY `idx_reseller_status_dibuat` (`status`, `dibuat_pada`),
  KEY `idx_reseller_pelanggan` (`pelanggan_id`),
  KEY `idx_reseller_admin` (`admin_id`),
  CONSTRAINT `fk_reseller_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reseller_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admin` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRODUK
CREATE TABLE IF NOT EXISTS `kategori` (
  `id` VARCHAR(40) NOT NULL,
  `nama` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(140) NOT NULL,
  `deskripsi` TEXT NULL,
  `ikon` VARCHAR(60) NOT NULL DEFAULT 'kategori',
  `gambar` VARCHAR(255) NOT NULL DEFAULT '',
  `status` ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_kategori_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `produk` (
  `id` VARCHAR(40) NOT NULL,
  `nama` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `kategori_id` VARCHAR(40) NULL,
  `jenis` VARCHAR(30) NOT NULL DEFAULT 'Skin',
  `deskripsi_singkat` VARCHAR(300) NOT NULL DEFAULT '',
  `deskripsi_lengkap` TEXT NULL,
  `harga` BIGINT NOT NULL DEFAULT 0,
  `harga_diskon` BIGINT NOT NULL DEFAULT 0,
  CHECK (`harga` >= 0),
  CHECK (`harga_diskon` >= 0),
  `thumbnail` VARCHAR(255) NOT NULL DEFAULT '',
  `preview` JSON NULL,
  `file_produk` VARCHAR(255) NOT NULL DEFAULT '',
  `versi_minecraft` VARCHAR(60) NOT NULL DEFAULT '',
  `creator` VARCHAR(120) NOT NULL DEFAULT '',
  `creator_id` VARCHAR(40) NULL DEFAULT NULL,
  `status` ENUM('Draft','Aktif','Nonaktif') NOT NULL DEFAULT 'Draft',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_produk_slug` (`slug`),
  KEY `idx_produk_kategori_status` (`kategori_id`, `status`),
  KEY `idx_produk_status` (`status`),
  KEY `idx_produk_jenis_status` (`jenis`, `status`),
  KEY `idx_produk_creator` (`creator_id`),
  CONSTRAINT `fk_produk_kategori`
    FOREIGN KEY (`kategori_id`) REFERENCES `kategori` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_produk_creator`
    FOREIGN KEY (`creator_id`) REFERENCES `creator` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promo` (
  `id` VARCHAR(40) NOT NULL,
  `kode` VARCHAR(40) NOT NULL,
  `nama` VARCHAR(120) NOT NULL,
  `diskon` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CHECK (`diskon` BETWEEN 0 AND 100),
  `mulai` DATE NULL DEFAULT NULL,
  `berakhir` DATE NULL DEFAULT NULL,
  `batas` INT NOT NULL DEFAULT 100,
  `terpakai` INT NOT NULL DEFAULT 0,
  `status` ENUM('Aktif','Terjadwal','Berakhir') NOT NULL DEFAULT 'Terjadwal',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_promo_kode` (`kode`),
  KEY `idx_promo_status` (`status`, `mulai`, `berakhir`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `media` (
  `id` VARCHAR(40) NOT NULL,
  `owner_tipe` VARCHAR(20) NULL DEFAULT NULL,
  `owner_id` VARCHAR(40) NULL DEFAULT NULL,
  `nama` VARCHAR(200) NOT NULL,
  `nama_asli` VARCHAR(200) NULL DEFAULT NULL,
  `nama_simpan` VARCHAR(255) NULL DEFAULT NULL,
  `jenis` VARCHAR(30) NOT NULL DEFAULT 'Thumbnail',
  `mime` VARCHAR(80) NOT NULL DEFAULT '',
  `ekstensi` VARCHAR(20) NULL DEFAULT NULL,
  `ukuran` BIGINT NOT NULL DEFAULT 0,
  `checksum` VARCHAR(64) NULL DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Aktif',
  `berkas` VARCHAR(255) NOT NULL DEFAULT '',
  `url` VARCHAR(255) NOT NULL DEFAULT '',
  `object_key` VARCHAR(255) NULL DEFAULT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `dihapus_pada` DATETIME NULL DEFAULT NULL,
  `tanggal` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_jenis` (`jenis`),
  KEY `idx_media_owner` (`owner_tipe`, `owner_id`),
  KEY `idx_media_owner_jenis` (`owner_tipe`, `owner_id`, `jenis`),
  KEY `idx_media_dibuat` (`dibuat_pada`),
  KEY `idx_media_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `produk_media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `produk_id` VARCHAR(40) NOT NULL,
  `media_id` VARCHAR(40) NOT NULL,
  `urutan` INT UNSIGNED NOT NULL DEFAULT 0,
  `peran` VARCHAR(30) NOT NULL DEFAULT 'galeri',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- PESANAN
CREATE TABLE IF NOT EXISTS `pesanan` (
  `id` VARCHAR(40) NOT NULL,
  `pelanggan_id` VARCHAR(40) NULL,
  `pelanggan_nama` VARCHAR(120) NOT NULL DEFAULT '',
  `email` VARCHAR(150) NOT NULL DEFAULT '',
  `whatsapp` VARCHAR(40) NOT NULL DEFAULT '',
  `produk_ringkas` VARCHAR(255) NOT NULL DEFAULT '',
  `kategori` VARCHAR(120) NOT NULL DEFAULT '',
  `metode` VARCHAR(60) NOT NULL DEFAULT '',
  `subtotal` BIGINT NOT NULL DEFAULT 0,
  `biaya_layanan` BIGINT NOT NULL DEFAULT 0,
  `potongan` BIGINT NOT NULL DEFAULT 0,
  `total` BIGINT NOT NULL DEFAULT 0,
  CHECK (`subtotal` >= 0),
  CHECK (`biaya_layanan` >= 0),
  CHECK (`potongan` >= 0),
  CHECK (`total` >= 0),
  `kode_promo` VARCHAR(40) NOT NULL DEFAULT '',
  `status` ENUM('Menunggu','Diproses','Berhasil','Gagal') NOT NULL DEFAULT 'Menunggu',
  `catatan` VARCHAR(255) NOT NULL DEFAULT '',
  `idempotency_key` VARCHAR(64) NULL DEFAULT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `dibatalkan_pada` DATETIME NULL DEFAULT NULL,
  `diselesaikan_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pesanan_idempotency` (`idempotency_key`),
  KEY `idx_pesanan_status_dibuat` (`status`, `dibuat_pada`),
  KEY `idx_pesanan_dibuat` (`dibuat_pada`),
  KEY `idx_pesanan_email` (`email`),
  KEY `idx_pesanan_pelanggan` (`pelanggan_id`, `status`, `dibuat_pada`),
  CONSTRAINT `fk_pesanan_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pesanan_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pesanan_id` VARCHAR(40) NOT NULL,
  `produk_id` VARCHAR(40) NULL,
  `nama` VARCHAR(160) NOT NULL DEFAULT '',
  `harga` BIGINT NOT NULL DEFAULT 0,
  `jumlah` INT NOT NULL DEFAULT 1,
  `subtotal` BIGINT NOT NULL DEFAULT 0,
  CHECK (`harga` >= 0),
  CHECK (`jumlah` >= 1),
  CHECK (`subtotal` >= 0),
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_item_pesanan` (`pesanan_id`),
  KEY `idx_item_produk` (`produk_id`),
  KEY `idx_item_dibuat` (`dibuat_pada`),
  CONSTRAINT `fk_item_pesanan`
    FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ulasan` (
  `id` VARCHAR(40) NOT NULL,
  `produk_id` VARCHAR(40) NULL,
  `produk_nama` VARCHAR(160) NOT NULL DEFAULT '',
  `pelanggan_id` VARCHAR(40) NULL,
  `pelanggan_nama` VARCHAR(120) NOT NULL DEFAULT '',
  `rating` TINYINT UNSIGNED NOT NULL DEFAULT 5,
  CHECK (`rating` BETWEEN 1 AND 5),
  `komentar` TEXT NULL,
  `tanggal` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Menunggu','Disetujui','Disembunyikan') NOT NULL DEFAULT 'Menunggu',
  PRIMARY KEY (`id`),
  KEY `idx_ulasan_produk` (`produk_id`),
  KEY `idx_ulasan_produk_status` (`produk_id`, `status`),
  KEY `idx_ulasan_status` (`status`),
  CONSTRAINT `fk_ulasan_produk`
    FOREIGN KEY (`produk_id`) REFERENCES `produk` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ulasan_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PEMBAYARAN
CREATE TABLE IF NOT EXISTS `pembayaran` (
  `id` VARCHAR(40) NOT NULL,
  `pesanan_id` VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL,
  `nominal` BIGINT NOT NULL DEFAULT 0,
  `mata_uang` VARCHAR(10) NOT NULL DEFAULT 'IDR',
  CHECK (`nominal` >= 0),
  `metode` VARCHAR(60) NOT NULL DEFAULT '',
  `akun_pembayaran` VARCHAR(255) NOT NULL DEFAULT '',
  `referensi` VARCHAR(255) NULL DEFAULT NULL,
  `transaction_id` VARCHAR(120) NULL DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Menunggu konfirmasi',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dikonfirmasi_pada` DATETIME NULL DEFAULT NULL,
  `gagal_pada` DATETIME NULL DEFAULT NULL,
  `dikembalikan_pada` DATETIME NULL DEFAULT NULL,
  `nominal_refund` BIGINT NOT NULL DEFAULT 0,
  CHECK (`nominal_refund` >= 0),
  `konfirmasi_admin` VARCHAR(60) NULL DEFAULT NULL,
  `catatan` VARCHAR(255) NOT NULL DEFAULT '',
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pembayaran_pesanan` (`pesanan_id`),
  UNIQUE KEY `uniq_pembayaran_idem` (`kode_idempotensi`),
  UNIQUE KEY `uniq_pembayaran_transaction` (`transaction_id`),
  KEY `idx_pembayaran_status` (`status`, `dibuat_pada`),
  CONSTRAINT `fk_pembayaran_pesanan`
    FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pembayaran_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pembayaran_id` VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL,
  `jenis` VARCHAR(40) NOT NULL,
  `status_saat_itu` VARCHAR(30) NULL DEFAULT NULL,
  `payload_ringkas` VARCHAR(500) NULL DEFAULT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_idem` (`pembayaran_id`, `kode_idempotensi`, `jenis`),
  KEY `idx_event_pembayaran` (`pembayaran_id`, `dibuat_pada`),
  CONSTRAINT `fk_event_pembayaran`
    FOREIGN KEY (`pembayaran_id`) REFERENCES `pembayaran` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CHAT
CREATE TABLE IF NOT EXISTS `percakapan` (
  `id` VARCHAR(40) NOT NULL,
  `tipe` ENUM('penjualan','cs') NOT NULL DEFAULT 'penjualan',
  `judul` VARCHAR(200) NOT NULL DEFAULT '',
  `status` ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
  `pelanggan_id` VARCHAR(40) NULL,
  `creator_id` VARCHAR(40) NULL,
  `produk_id` VARCHAR(40) NULL,
  `pesanan_id` VARCHAR(40) NULL,
  `cs_petugas_id` INT UNSIGNED NULL,
  `pesan_terakhir_id` VARCHAR(40) NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `kunci_dedup` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_percakapan_dedup` (`kunci_dedup`),
  UNIQUE KEY `uniq_percakapan_pesanan` (`pesanan_id`),
  KEY `idx_percakapan_status` (`status`),
  KEY `idx_percakapan_dibuat` (`dibuat_pada`),
  KEY `idx_percakapan_pelanggan` (`pelanggan_id`),
  KEY `idx_percakapan_creator` (`creator_id`),
  KEY `idx_percakapan_produk` (`produk_id`),
  KEY `idx_percakapan_cs_petugas` (`cs_petugas_id`),
  CONSTRAINT `fk_percakapan_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_creator`
    FOREIGN KEY (`creator_id`) REFERENCES `creator` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_produk`
    FOREIGN KEY (`produk_id`) REFERENCES `produk` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_pesanan`
    FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_cs_petugas`
    FOREIGN KEY (`cs_petugas_id`) REFERENCES `admin` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `anggota_percakapan` (
  `id` VARCHAR(40) NOT NULL,
  `percakapan_id` VARCHAR(40) NOT NULL,
  `user_tipe` VARCHAR(20) NOT NULL,
  `user_id` VARCHAR(40) NOT NULL,
  `peran` VARCHAR(20) NOT NULL,
  `bergabung_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `keluar_pada` DATETIME NULL DEFAULT NULL,
  `terakhir_baca_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_anggota` (`percakapan_id`, `user_tipe`, `user_id`),
  KEY `idx_anggota_user` (`user_tipe`, `user_id`),
  CONSTRAINT `fk_anggota_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pesan` (
  `id` VARCHAR(40) NOT NULL,
  `percakapan_id` VARCHAR(40) NOT NULL,
  `pengirim_tipe` VARCHAR(20) NOT NULL,
  `pengirim_id` VARCHAR(40) NOT NULL,
  `teks` TEXT NULL,
  `tipe` VARCHAR(20) NOT NULL DEFAULT 'teks',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `dihapus_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pesan_percakapan_kirim` (`percakapan_id`, `dibuat_pada`, `id`),
  KEY `idx_pesan_pengirim` (`pengirim_tipe`, `pengirim_id`),
  CONSTRAINT `fk_pesan_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pesan_lampiran` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pesan_id` VARCHAR(40) NOT NULL,
  `media_id` VARCHAR(40) NOT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS `pesan_baca` (
  `pesan_id` VARCHAR(40) NOT NULL,
  `user_tipe` VARCHAR(20) NOT NULL,
  `user_id` VARCHAR(40) NOT NULL,
  `dibaca_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pesan_id`, `user_tipe`, `user_id`),
  KEY `idx_baca_user` (`user_tipe`, `user_id`, `dibaca_pada`),
  CONSTRAINT `fk_baca_pesan`
    FOREIGN KEY (`pesan_id`) REFERENCES `pesan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LAINNYA
CREATE TABLE IF NOT EXISTS `riwayat_tontonan` (
  `id` VARCHAR(40) NOT NULL,
  `pelanggan_id` VARCHAR(40) NOT NULL,
  `video_id` VARCHAR(40) NOT NULL,
  `posisi_detik` INT UNSIGNED NOT NULL DEFAULT 0,
  `durasi_detik` INT UNSIGNED NULL DEFAULT NULL,
  `terakhir_ditonton` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `progres_persen` DECIMAL(5,2)
    GENERATED ALWAYS AS (
      CASE
        WHEN `durasi_detik` IS NULL OR `durasi_detik` = 0 THEN 0
        ELSE ROUND(`posisi_detik` / `durasi_detik` * 100, 2)
      END
    ) STORED,
  `selesai` TINYINT(1)
    GENERATED ALWAYS AS (
      CASE
        WHEN `durasi_detik` IS NULL OR `durasi_detik` = 0 THEN 0
        WHEN `posisi_detik` >= `durasi_detik` THEN 1
        ELSE 0
      END
    ) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_riwayat_pelanggan_video` (`pelanggan_id`, `video_id`),
  KEY `idx_riwayat_pelanggan_terakhir` (`pelanggan_id`, `terakhir_ditonton`),
  KEY `idx_riwayat_video` (`video_id`),
  CONSTRAINT `fk_riwayat_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AUDIT
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_tipe` VARCHAR(20) NULL DEFAULT NULL,
  `user_id` VARCHAR(40) NULL DEFAULT NULL,
  `jenis_aktivitas` VARCHAR(60) NOT NULL,
  `hasil` VARCHAR(20) NOT NULL DEFAULT 'Berhasil',
  `target_table` VARCHAR(60) NULL DEFAULT NULL,
  `target_id` VARCHAR(100) NULL DEFAULT NULL,
  `teks` VARCHAR(255) NOT NULL,
  `detail_json` JSON NULL,
  `ikon` VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  `warna` VARCHAR(20) NOT NULL DEFAULT 'hijau',
  `alamat_ip` VARCHAR(45) NULL DEFAULT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_tipe`, `user_id`, `dibuat_pada`),
  KEY `idx_audit_jenis` (`jenis_aktivitas`, `dibuat_pada`),
  KEY `idx_audit_target` (`target_table`, `target_id`),
  KEY `idx_audit_dibuat` (`dibuat_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `aktivitas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `teks` VARCHAR(255) NOT NULL,
  `ikon` VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  `warna` VARCHAR(20) NOT NULL DEFAULT 'hijau',
  `admin_pengguna` VARCHAR(60) NULL DEFAULT NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT
    `id` AS `pesanan_id`,
    `pelanggan_id`,
    `pelanggan_nama`,
    `produk_ringkas`,
    `total`,
    `status`,
    `kode_promo`,
    `catatan`,
    `dibuat_pada`,
    `diperbarui_pada`
FROM `pesanan`
WHERE `status` IN ('Menunggu', 'Diproses', 'Gagal')
ORDER BY `dibuat_pada` DESC;

-- ============================================================================
-- VIEW: pembayaran yang menunggu konfirmasi
-- ============================================================================
SELECT
    `id` AS `pembayaran_id`,
    `pesanan_id`,
    `nominal`,
    `metode`,
    `akun_pembayaran`,
    `dibuat_pada`,
    `diperbarui_pada`
FROM `pembayaran`
WHERE `status` = 'Menunggu konfirmasi'
ORDER BY `dibuat_pada` ASC;

-- ============================================================================
-- VIEW: audit log kegagalan (untuk investigasi keamanan)
-- ============================================================================
SELECT
    `id`,
    `user_tipe`,
    `user_id`,
    `jenis_aktivitas`,
    `target_table`,
    `target_id`,
    `detail_json`,
    `alamat_ip`,
    `dibuat_pada`
FROM `audit_log`
WHERE `hasil` <> 'Berhasil'
  AND `jenis_aktivitas` IN (
      'login_gagal',
      'ganti_status_pesanan',
      'hapus_produk',
      'ulkah_edit',
      'ukur_harga',
      'atur_reseller'
  )
ORDER BY `dibuat_pada` DESC;
-- ============================================================================
-- INDEX TAMBAHAN untuk performa query umum
-- ============================================================================
CREATE INDEX IF NOT EXISTS `idx_pesanan_status_dibuat`
  ON `pesanan` (`status`, `dibuat_pada`);

CREATE INDEX IF NOT EXISTS `idx_pembayaran_status_dibuat`
  ON `pembayaran` (`status`, `dibuat_pada`);

CREATE INDEX IF NOT EXISTS `idx_ulasan_status_produk`
  ON `ulasan` (`produk_id`, `status`);

CREATE INDEX IF NOT EXISTS `idx_riwayat_video_terakhir`
  ON `riwayat_tontonan` (`video_id`, `terakhir_ditonton`);





-- ============================================================================
-- SEMUA TRIGGER DITERUSKAN KE BACKEND PHP
-- ==========================================================================--
-- InfinityFree shared MySQL tidak memberi hak TRIGGER (error #1142),
-- sehingga semua audit log status/profil sekarang ditulis oleh aplikasi
-- melalui Aktivitas::audit() yang dipanggil di dalam Database::transaksi().
-- Desain ini memastikan atomicity: UPDATE + audit terjadi bersama-sama,
-- atau jika audit gagal, transaksi digulirkan untuk menjaga konsistensi.
--
-- Peta logika yang dipindahkan:
--   trg_pesanan_after_update     -> audit ubah_status_pesanan     (PengendaliPesanan::ubahStatus)
--   trg_pembayaran_after_update  -> audit ubah_status_pembayaran  (PengendaliPembayaran::ubah)
--   trg_produk_after_update      -> audit ubah_status_produk    (PengendaliProduk::simpan)
--   trg_admin_after_update       -> audit ubah_status_admin     (PengendaliAuth::ubahAdmin)
--   trg_ulasan_after_insert      -> validasi auto-approve rating>=4 (PengendaliUlasan::kirim)
--
-- Migrasi M0 (database/migrasi.php) menjalankan DROP TRIGGER IF EXISTS
-- untuk 5 trigger lama bersifat idempoten (bisa dijalankan berkali-kali).
-- SETANA LINTAS: SETELAH schema.sql diterapkan di DB, migrasi M0 bisa
-- dijalankan untuk membersihkan trigger lama yang masih ada.
--
-- +++ PERBAikan F-V5-04: SEMUA CHECK CONSTRAINT TAMBAHAN IDempotent +++
-- Semua ALTER TABLE ADD CONSTRAINT CHECK di-selenggarai dengan IF NOT EXISTS
-- agar skema dapat dieksekusi berulang kali tanpa error "Duplicate CHECK constraint".
-- Lihat setiap constraint di bawah ini (baris 610-670).
-- ============================================================================



-- ============================================================================
-- PENINGKATAN KETERECANAAN & INTEGRITAS DATA
-- (tambahan ALTER TABLE untuk tabel yang ada)
-- ============================================================================

-- 1) Admin: lacak percobaan login gagal (untuk rate limiting di aplikasi)
ALTER TABLE `admin`
  ADD COLUMN IF NOT EXISTS `gagal_login` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `sandi_hash`,
  ADD COLUMN IF NOT EXISTS `terakhir_gagal_login` DATETIME NULL DEFAULT NULL
    AFTER `gagal_login`;

-- 2) Pelanggan: catat waktu login terakhir (untuk aktivitas, batas usia akun)
ALTER TABLE `pelanggan`
  ADD COLUMN IF NOT EXISTS `terakhir_login` DATETIME NULL DEFAULT NULL
    AFTER `jumlah_pesanan`;

-- 3) Produk: pastikan diskon tidak melebihi harga (ketika diskon > 0)
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `produk`
  ADD CONSTRAINT IF NOT EXISTS `chk_produk_diskon_harga`
    CHECK (`harga_diskon` = 0 OR `harga_diskon` <= `harga`);

-- 4) Promo: pastikan tanggal berakhir >= tanggal mulai
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `promo`
  ADD CONSTRAINT IF NOT EXISTS `chk_promo_range_waktu`
    CHECK (`berakhir` IS NULL OR `mulai` IS NULL OR `berakhir` >= `mulai`);

-- 5) Pesanan: hindari total yang tidak masuk akal
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `pesanan`
  ADD CONSTRAINT IF NOT EXISTS `chk_pesanan_total_reasonable`
    CHECK (`total` <= `subtotal` + `biaya_layanan` + 1000000);

-- 6) Pembayaran: pastikan nominal_refund tidak melebihi nominal
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `pembayaran`
  ADD CONSTRAINT IF NOT EXISTS `chk_pembayaran_refund_bukan_lebih`
    CHECK (`nominal_refund` <= `nominal`);

-- 7) Riwayat tontonan: pastikan posisi_detik tidak melebihi durasi_detik
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `riwayat_tontonan`
  ADD CONSTRAINT IF NOT EXISTS `chk_riwayat_posisi_bawah_durasi`
    CHECK (`posisi_detik` <= IFNULL(`durasi_detik`, POWER(2, 32) - 1));

-- 8) Ulasan: status default yang konsisten
ALTER TABLE `ulasan`
  MODIFY COLUMN `status` ENUM('Menunggu','Disetujui','Disembunyikan') NOT NULL
    DEFAULT 'Menunggu' AFTER `komentar`;

-- 9) Pesan: pastikan teks tidak kosong bila tipe = 'teks'
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `pesan`
  ADD CONSTRAINT IF NOT EXISTS `chk_pesan_teks_wajib_bila_tipe_teks`
    CHECK (`tipe` <> 'teks' OR (CHAR_LENGTH(`teks`) > 0));

-- 10) Percakapan: pastikan setidaknya ada anggota
-- Gunakan IF NOT EXISTS agar skema aman dijalankan berulang kali.
-- Catatan: MySQL < 8.0.16 mem-parse CHECK tapi tidak menegakkan;
-- validasi utama diletakkan di backend PHP (Aktivitas::audit + transaksi).
ALTER TABLE `anggota_percakapan`
  ADD CONSTRAINT IF NOT EXISTS `chk_anggota_bukan_null`
    CHECK (`user_tipe` <> '' AND `user_id` <> '');



SET FOREIGN_KEY_CHECKS = 1;
