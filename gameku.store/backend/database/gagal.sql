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