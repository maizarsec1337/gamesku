-- Skema database Gameku.store (MySQL 5.7+ / MariaDB 10.2+).

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `gameku_store`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gameku_store`;

-- ---------- Admin ----------
CREATE TABLE IF NOT EXISTS `admin` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pengguna`       VARCHAR(60)  NOT NULL,
  `nama`           VARCHAR(120) NOT NULL DEFAULT '',
  `email`          VARCHAR(150) NOT NULL DEFAULT '',
  `sandi_hash`     VARCHAR(255) NOT NULL,
  `status`         ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `dibuat_pada`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `masuk_terakhir` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_pengguna` (`pengguna`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Kategori ----------
CREATE TABLE IF NOT EXISTS `kategori` (
  `id`              VARCHAR(40) NOT NULL,
  `nama`            VARCHAR(120) NOT NULL,
  `slug`            VARCHAR(140) NOT NULL,
  `deskripsi`       TEXT NULL,
  `ikon`            VARCHAR(60) NOT NULL DEFAULT 'kategori',
  `gambar`          VARCHAR(255) NOT NULL DEFAULT '',
  `status`          ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_kategori_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Creator ----------
CREATE TABLE IF NOT EXISTS `creator` (
  `id`        VARCHAR(40) NOT NULL,
  `nama`      VARCHAR(120) NOT NULL,
  `username`  VARCHAR(60) NOT NULL DEFAULT '',
  `produk`    INT NOT NULL DEFAULT 0,
  `penjualan` INT NOT NULL DEFAULT 0,
  `pendapatan`BIGINT NOT NULL DEFAULT 0,
  `bergabung` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`    ENUM('Aktif','Review','Ditangguhkan') NOT NULL DEFAULT 'Review',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_creator_nama` (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Produk ----------
CREATE TABLE IF NOT EXISTS `produk` (
  `id`                VARCHAR(40) NOT NULL,
  `nama`              VARCHAR(160) NOT NULL,
  `slug`              VARCHAR(180) NOT NULL,
  `kategori_id`       VARCHAR(40) NULL,
  `jenis`             VARCHAR(30) NOT NULL DEFAULT 'Skin',
  `deskripsi_singkat` VARCHAR(300) NOT NULL DEFAULT '',
  `deskripsi_lengkap` TEXT NULL,
  `harga`             BIGINT NOT NULL DEFAULT 0,
  `harga_diskon`      BIGINT NOT NULL DEFAULT 0,
  `thumbnail`         VARCHAR(255) NOT NULL DEFAULT '',
  `preview`           JSON NULL,
  `file_produk`       VARCHAR(255) NOT NULL DEFAULT '',
  `versi_minecraft`   VARCHAR(60) NOT NULL DEFAULT '',
  `creator`           VARCHAR(120) NOT NULL DEFAULT '',
  `status`            ENUM('Draft','Aktif','Nonaktif') NOT NULL DEFAULT 'Draft',
  `dibuat_pada`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada`   DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_produk_slug` (`slug`),
  KEY `idx_produk_kategori` (`kategori_id`),
  KEY `idx_produk_status` (`status`),
  CONSTRAINT `fk_produk_kategori` FOREIGN KEY (`kategori_id`)
    REFERENCES `kategori` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_produk_harga` CHECK (`harga` >= 0),
  CONSTRAINT `chk_produk_diskon` CHECK (`harga_diskon` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Promo ----------
CREATE TABLE IF NOT EXISTS `promo` (
  `id`          VARCHAR(40) NOT NULL,
  `kode`        VARCHAR(40) NOT NULL,
  `nama`        VARCHAR(120) NOT NULL,
  `diskon`      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `mulai`       DATE NULL DEFAULT NULL,
  `berakhir`    DATE NULL DEFAULT NULL,
  `batas`       INT NOT NULL DEFAULT 100,
  `terpakai`    INT NOT NULL DEFAULT 0,
  `status`      ENUM('Aktif','Terjadwal','Berakhir') NOT NULL DEFAULT 'Terjadwal',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_promo_kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------- Pelanggan ----------
CREATE TABLE IF NOT EXISTS `pelanggan` (
  `id`             VARCHAR(40) NOT NULL,
  `nama`           VARCHAR(120) NOT NULL DEFAULT '',
  `username`       VARCHAR(60) NOT NULL DEFAULT '',
  `email`          VARCHAR(150) NOT NULL,
  `sandi_hash`     VARCHAR(255) NULL DEFAULT NULL,
  `total_beli`     BIGINT NOT NULL DEFAULT 0,
  `jumlah_pesanan` INT NOT NULL DEFAULT 0,
  `bergabung`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`         ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pelanggan_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Pesanan ----------
CREATE TABLE IF NOT EXISTS `pesanan` (
  `id`              VARCHAR(40) NOT NULL,
  `pelanggan_id`    VARCHAR(40) NULL,
  `pelanggan_nama`  VARCHAR(120) NOT NULL DEFAULT '',
  `email`           VARCHAR(150) NOT NULL DEFAULT '',
  `whatsapp`        VARCHAR(40) NOT NULL DEFAULT '',
  `produk_ringkas`  VARCHAR(255) NOT NULL DEFAULT '',
  `kategori`        VARCHAR(120) NOT NULL DEFAULT '',
  `metode`          VARCHAR(60) NOT NULL DEFAULT '',
  `subtotal`        BIGINT NOT NULL DEFAULT 0,
  `biaya_layanan`   BIGINT NOT NULL DEFAULT 0,
  `potongan`        BIGINT NOT NULL DEFAULT 0,
  `total`           BIGINT NOT NULL DEFAULT 0,
  `kode_promo`      VARCHAR(40) NOT NULL DEFAULT '',
  `status`          ENUM('Menunggu','Diproses','Berhasil','Gagal') NOT NULL DEFAULT 'Menunggu',
  `catatan`         VARCHAR(255) NOT NULL DEFAULT '',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pesanan_status_dibuat` (`status`, `dibuat_pada`),
  KEY `idx_pesanan_dibuat` (`dibuat_pada`),
  KEY `idx_pesanan_pelanggan` (`pelanggan_id`),
  CONSTRAINT `fk_pesanan_pelanggan` FOREIGN KEY (`pelanggan_id`)
    REFERENCES `pelanggan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Item Pesanan (baris keranjang per pesanan) ----------
CREATE TABLE IF NOT EXISTS `pesanan_item` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pesanan_id`VARCHAR(40) NOT NULL,
  `produk_id` VARCHAR(40) NULL,
  `nama`      VARCHAR(160) NOT NULL DEFAULT '',
  `harga`     BIGINT NOT NULL DEFAULT 0,
  `jumlah`    INT NOT NULL DEFAULT 1,
  `subtotal`  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_item_pesanan` (`pesanan_id`),
  KEY `idx_item_produk` (`produk_id`),
  CONSTRAINT `fk_item_pesanan` FOREIGN KEY (`pesanan_id`)
    REFERENCES `pesanan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Ulasan ----------
CREATE TABLE IF NOT EXISTS `ulasan` (
  `id`              VARCHAR(40) NOT NULL,
  `produk_id`       VARCHAR(40) NULL,
  `produk_nama`     VARCHAR(160) NOT NULL DEFAULT '',
  `pelanggan_id`    VARCHAR(40) NULL,
  `pelanggan_nama`  VARCHAR(120) NOT NULL DEFAULT '',
  `rating`          TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `komentar`        TEXT NULL,
  `tanggal`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`          ENUM('Menunggu','Disetujui','Disembunyikan') NOT NULL DEFAULT 'Menunggu',
  PRIMARY KEY (`id`),
  KEY `idx_ulasan_produk` (`produk_id`),
  KEY `idx_ulasan_status` (`status`),
  CONSTRAINT `fk_ulasan_produk` FOREIGN KEY (`produk_id`)
    REFERENCES `produk` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------- Media ----------
CREATE TABLE IF NOT EXISTS `media` (
  `id`      VARCHAR(40) NOT NULL,
  `nama`    VARCHAR(200) NOT NULL,
  `jenis`   VARCHAR(30) NOT NULL DEFAULT 'Thumbnail',
  `mime`    VARCHAR(80) NOT NULL DEFAULT '',
  `ukuran`  BIGINT NOT NULL DEFAULT 0,
  `berkas`  VARCHAR(255) NOT NULL DEFAULT '',
  `url`     VARCHAR(255) NOT NULL DEFAULT '',
  `tanggal` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_jenis` (`jenis`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riwayat tontonan Streamku: satu catatan aktif per (pelanggan, video).
-- `video_id` bukan foreign key (video dari API eksternal, tanpa tabel lokal).
CREATE TABLE IF NOT EXISTS `riwayat_tontonan` (
  `id`                VARCHAR(40) NOT NULL,
  `pelanggan_id`      VARCHAR(40) NOT NULL,
  `video_id`          VARCHAR(120) NOT NULL,
  `mulai_menonton`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `posisi_detik`      INT UNSIGNED NOT NULL DEFAULT 0,
  `durasi_detik`      INT UNSIGNED NULL DEFAULT NULL,
  `progres_persen`    DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN `durasi_detik` IS NULL OR `durasi_detik` = 0 THEN NULL
      ELSE LEAST(100.00, GREATEST(0.00, (`posisi_detik` / `durasi_detik`) * 100))
    END
  ) STORED NULL,
  `selesai`           TINYINT(1) GENERATED ALWAYS AS (
    CASE
      WHEN `durasi_detik` IS NULL OR `durasi_detik` = 0 THEN 0
      WHEN `posisi_detik` >= (`durasi_detik` * 0.9) THEN 1
      ELSE 0
    END
  ) STORED NOT NULL,
  `terakhir_ditonton` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  `dibuat_pada`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada`   DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- Batas realistis 24 jam; CHECK diabaikan MySQL 5.7, ditegakkan 8.0.16+.
  CONSTRAINT `chk_riwayat_durasi` CHECK (`durasi_detik` IS NULL OR `durasi_detik` BETWEEN 1 AND 86400),
  CONSTRAINT `chk_riwayat_posisi` CHECK (`posisi_detik` <= 86400),
  PRIMARY KEY (`id`),
  -- Tonton ulang = UPDATE progres, bukan duplikat.
  UNIQUE KEY `uniq_riwayat_pelanggan_video` (`pelanggan_id`, `video_id`),
  KEY `idx_riwayat_pelanggan_terakhir` (`pelanggan_id`, `terakhir_ditonton`),
  KEY `idx_riwayat_video` (`video_id`),
  CONSTRAINT `fk_riwayat_pelanggan` FOREIGN KEY (`pelanggan_id`)
    REFERENCES `pelanggan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Aktivitas (audit log) ----------
CREATE TABLE IF NOT EXISTS `aktivitas` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `teks`           VARCHAR(255) NOT NULL,
  `ikon`           VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  `warna`          VARCHAR(20) NOT NULL DEFAULT 'hijau',
  `admin_pengguna` VARCHAR(60) NULL DEFAULT NULL,
  `dibuat_pada`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

