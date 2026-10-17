-- ============================================================
-- Skema database Gameku.store — SATU FILE FINAL siap impor phpMyAdmin.
-- Target: MySQL 5.7+ (InfinityFree) / MariaDB 10.2+, InnoDB, utf8mb4.
-- Cara pakai: di phpMyAdmin pilih database (panel kiri) > menu Import >
--   pilih file ini > Go. TIDAK perlu membuat database via SQL.
-- Sifat: idempoten (semua CREATE TABLE IF NOT EXISTS) — impor ulang aman.
-- Isi: 21 tabel (12 lama dipertahankan + 9 baru: percakapan,
--   anggota_percakapan, pesan, pesan_lampiran, pesan_baca, pembayaran,
--   pembayaran_event, audit_log, produk_media; kolom baru di media,
--   produk, pesanan, pesanan_item).
-- Chat: 2 tipe saja — 'penjualan' (SATU thread per pembeli+penjual;
--   konteks produk/pesanan opsional) dan 'cs' (SATU thread aktif per
--   pengguna; status open|in_progress|closed; alih petugas CS tanpa
--   menghapus riwayat). Peran CS: kolom admin.peran + FK cs_petugas_id.
-- Generated column memakai bentuk portabel (TANPA NULL/NOT NULL
--   trailing) agar sah di MySQL 5.7+ DAN MariaDB 10.2+.
-- Keamanan: TIDAK ada kredensial, password, token, PIN, CVV, atau data
--   demo dalam file ini. Kata "TANPA ..." di komentar = penegasan larangan.
-- Catatan versi: CHECK bernama lolos parsing di MySQL 5.7 (diabaikan) dan
--   ditegakkan di MySQL 8.0.16+/MariaDB 10.2+. Validasi tetap di aplikasi.
-- File foto fisik TIDAK tersimpan di SQL — hanya metadata di tabel `media`.
-- File migrasi di backend/database/migrations/ = arsip pengembangan saja.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- Admin ----------
CREATE TABLE IF NOT EXISTS `admin` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pengguna`       VARCHAR(60)  NOT NULL,
  `nama`           VARCHAR(120) NOT NULL DEFAULT '',
  `email`          VARCHAR(150) NOT NULL DEFAULT '',
  `sandi_hash`     VARCHAR(255) NOT NULL,
  `status`         ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `peran`          VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT 'hak akses: super|admin|cs; cs=petugas layanan bantuan',
  `dibuat_pada`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `masuk_terakhir` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_pengguna` (`pengguna`),
  CONSTRAINT `chk_admin_peran` CHECK (`peran` IN ('super','admin','cs'))
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
  `creator`           VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'kolom lama; dipertahankan (dual-write)',
  `creator_id`        VARCHAR(40) NULL DEFAULT NULL COMMENT 'FK ke creator.id; NULL=belum dipetakan',
  `status`            ENUM('Draft','Aktif','Nonaktif') NOT NULL DEFAULT 'Draft',
  `dibuat_pada`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada`   DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_produk_slug` (`slug`),
  KEY `idx_produk_kategori_status` (`kategori_id`, `status`),
  KEY `idx_produk_status` (`status`),
  KEY `idx_produk_creator` (`creator_id`),
  CONSTRAINT `fk_produk_kategori` FOREIGN KEY (`kategori_id`)
    REFERENCES `kategori` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_produk_creator` FOREIGN KEY (`creator_id`)
    REFERENCES `creator` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
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
  UNIQUE KEY `uniq_promo_kode` (`kode`),
  KEY `idx_promo_status` (`status`, `mulai`, `berakhir`),
  CONSTRAINT `chk_promo_pakai` CHECK (`terpakai` >= 0 AND `batas` >= 0)
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
  `dibatalkan_pada` DATETIME NULL DEFAULT NULL COMMENT 'NULL=belum/tidak dibatalkan',
  `diselesaikan_pada` DATETIME NULL DEFAULT NULL COMMENT 'NULL=belum selesai',
  PRIMARY KEY (`id`),
  KEY `idx_pesanan_status_dibuat` (`status`, `dibuat_pada`),
  KEY `idx_pesanan_dibuat` (`dibuat_pada`),
  KEY `idx_pesanan_pelanggan` (`pelanggan_id`, `status`, `dibuat_pada`),
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
  `dibuat_pada`     DATETIME NULL DEFAULT NULL COMMENT 'aproksimasi dari pesanan induk',
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_item_pesanan` (`pesanan_id`),
  KEY `idx_item_produk` (`produk_id`),
  KEY `idx_item_dibuat` (`dibuat_pada`),
  CONSTRAINT `chk_item_jumlah` CHECK (`jumlah` >= 1),
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
  KEY `idx_ulasan_produk_status` (`produk_id`, `status`),
  KEY `idx_ulasan_status` (`status`),
  CONSTRAINT `chk_ulasan_bintang` CHECK (`rating` BETWEEN 1 AND 5),
  CONSTRAINT `fk_ulasan_produk` FOREIGN KEY (`produk_id`)
    REFERENCES `produk` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------- Media (final: modul B — metadata file + owner polimorfik) ----------
-- File fisik di server/object storage; DB hanya menyimpan metadata/referensi.
-- `tanggal` lama DIPERTAHANKAN untuk kompatibilitas backend lama.
-- `owner_tipe`+`owner_id` TANPA FK (polimorfik: pelanggan|creator|admin).
-- Otorisasi akses tetap di lapisan aplikasi, bukan hanya constraint SQL.
CREATE TABLE IF NOT EXISTS `media` (
  `id`              VARCHAR(40) NOT NULL,
  `owner_tipe`      VARCHAR(20) NULL DEFAULT NULL COMMENT 'pelanggan|creator|admin',
  `owner_id`        VARCHAR(40) NULL DEFAULT NULL COMMENT 'id pemilik; tanpa FK (polimorfik)',
  `nama`            VARCHAR(200) NOT NULL,
  `nama_asli`       VARCHAR(200) NULL DEFAULT NULL COMMENT 'nama file asli saat diunggah',
  `nama_simpan`     VARCHAR(255) NULL DEFAULT NULL COMMENT 'nama file di storage',
  `jenis`           VARCHAR(30) NOT NULL DEFAULT 'Thumbnail',
  `mime`            VARCHAR(80) NOT NULL DEFAULT '',
  `ekstensi`        VARCHAR(20) NULL DEFAULT NULL COMMENT 'ekstensi tanpa titik',
  `ukuran`          BIGINT NOT NULL DEFAULT 0,
  `checksum`        VARCHAR(64) NULL DEFAULT NULL COMMENT 'sha256 hex; bukan isi file',
  `status`          VARCHAR(20) NOT NULL DEFAULT 'Aktif' COMMENT 'Aktif|Dihapus',
  `berkas`          VARCHAR(255) NOT NULL DEFAULT '',
  `url`             VARCHAR(255) NOT NULL DEFAULT '',
  `object_key`      VARCHAR(255) NULL DEFAULT NULL COMMENT 'lokasi/object key storage',
  `dibuat_pada`     DATETIME NULL DEFAULT NULL COMMENT 'waktu unggah (dari tanggal lama)',
  `diperbarui_pada` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `dihapus_pada`    DATETIME NULL DEFAULT NULL COMMENT 'hapus logis; NULL=aktif',
  `tanggal`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'kolom lama; dipertahankan',
  PRIMARY KEY (`id`),
  KEY `idx_media_jenis` (`jenis`),
  KEY `idx_media_owner` (`owner_tipe`, `owner_id`),
  KEY `idx_media_owner_jenis` (`owner_tipe`, `owner_id`, `jenis`),
  KEY `idx_media_dibuat` (`dibuat_pada`),
  KEY `idx_media_status` (`status`),
  CONSTRAINT `chk_media_ukuran` CHECK (`ukuran` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Percakapan/chat (final: modul C — DUA TIPE SAJA) ----------
-- Tipe 'penjualan': pembeli (pelanggan) <-> penjual (creator).
--   Anti-duplikasi: SATU thread per (pembeli, penjual) lewat kunci_dedup
--   UNIQUE; produk_id/pesanan_id hanya KONTEKS terakhir (jika ada) dan
--   wajib milik pelanggan yang sama (aturan aplikasi: pesanan.pelanggan_id
--   = percakapan.pelanggan_id saat menautkan). Isolasi: thread hanya
--   dihuni 2 anggota tsb sehingga tidak dapat dipakai mengakses transaksi
--   pengguna lain — pembatasan via anggota_percakapan + FK komposit
--   pengirim di tabel pesan, bukan nilai dari frontend.
-- Tipe 'cs': pengguna (pelanggan ATAU creator) <-> petugas CS (admin).
--   SATU thread AKTIF per pengguna; status 'closed' membuat kunci_dedup
--   NULL sehingga pengguna boleh membuka thread baru. Status:
--   open|in_progress|closed. Pengalihan petugas: UPDATE cs_petugas_id,
--   baris anggota petugas lama diisi keluar_pada, petugas baru ditambah —
--   riwayat pesan TIDAK dihapus. Peran CS diverifikasi dari admin.peran +
--   status 'Aktif' milik id sesi login (bukan klaim frontend).
-- Nasib FK: pelanggan/creator dihapus -> thread ikut terhapus;
--   produk/pesanan dihapus -> konteks SET NULL; petugas CS dihapus ->
--   cs_petugas_id NULL (percakapan & pesan tetap ada).
CREATE TABLE IF NOT EXISTS `percakapan` (
  `id`                VARCHAR(40)  NOT NULL,
  `tipe`              ENUM('penjualan','cs') NOT NULL DEFAULT 'penjualan'
                        COMMENT 'penjualan|cs',
  `judul`             VARCHAR(200) NOT NULL DEFAULT '',
  `status`            ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open'
                        COMMENT 'penanganan percakapan; penjualan memakai open/closed',
  `pelanggan_id`      VARCHAR(40)  NULL COMMENT 'penjualan: pembeli; cs: pengguna pelanggan (FK pelanggan.id)',
  `creator_id`        VARCHAR(40)  NULL COMMENT 'penjualan: penjual; cs: pengguna creator (FK creator.id)',
  `produk_id`         VARCHAR(40)  NULL COMMENT 'produk terkait (hanya penjualan; jika ada)',
  `pesanan_id`        VARCHAR(40)  NULL COMMENT 'pesanan terkait (hanya penjualan; jika ada; milik pelanggan_id)',
  `cs_petugas_id`     INT UNSIGNED NULL COMMENT 'petugas CS aktif (FK admin.id); NULL=belum ditangani',
  `pesan_terakhir_id` VARCHAR(40)  NULL COMMENT 'denormalisasi opsional; tanpa FK (pesan didefinisikan sesudahnya)',
  `dibuat_pada`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diperbarui_pada`   DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- Kunci anti-duplikasi (generated, STORED). Bentuk portabel: TANPA
  -- NULL/NOT NULL trailing — klause trailing ditolak MariaDB (error 1064),
  -- NULL implisit berlaku di MySQL maupun MariaDB.
  `kunci_dedup`       VARCHAR(100) GENERATED ALWAYS AS (
    CASE
      WHEN `tipe` = 'penjualan' THEN
        CONCAT('jual:', `pelanggan_id`, ':', `creator_id`)
      WHEN `tipe` = 'cs' AND `status` <> 'closed' THEN
        CONCAT('cs:', IF(`pelanggan_id` IS NOT NULL,
                         CONCAT('p:', `pelanggan_id`),
                         CONCAT('c:', `creator_id`)))
      ELSE NULL
    END
  ) STORED COMMENT 'penjualan: unik per (pembeli,penjual); cs: unik selama aktif',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_percakapan_dedup` (`kunci_dedup`),
  UNIQUE KEY `uniq_percakapan_pesanan` (`pesanan_id`),
  KEY `idx_percakapan_status` (`status`),
  KEY `idx_percakapan_dibuat` (`dibuat_pada`),
  KEY `idx_percakapan_pelanggan` (`pelanggan_id`),
  KEY `idx_percakapan_creator` (`creator_id`),
  KEY `idx_percakapan_produk` (`produk_id`),
  KEY `idx_percakapan_cs_petugas` (`cs_petugas_id`),
  CONSTRAINT `fk_percakapan_pelanggan` FOREIGN KEY (`pelanggan_id`)
    REFERENCES `pelanggan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_creator` FOREIGN KEY (`creator_id`)
    REFERENCES `creator` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_produk` FOREIGN KEY (`produk_id`)
    REFERENCES `produk` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_pesanan` FOREIGN KEY (`pesanan_id`)
    REFERENCES `pesanan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_percakapan_cs_petugas` FOREIGN KEY (`cs_petugas_id`)
    REFERENCES `admin` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  -- Konteks wajib konsisten dengan tipe (ditegakkan MySQL 8.0.16+/
  -- MariaDB 10.2+; MySQL 5.7 mengabaikan CHECK -> validasi di aplikasi).
  CONSTRAINT `chk_percakapan_konteks` CHECK (
    (`tipe` = 'penjualan'
      AND `pelanggan_id` IS NOT NULL AND `creator_id` IS NOT NULL
      AND `cs_petugas_id` IS NULL)
    OR
    (`tipe` = 'cs'
      AND (`pelanggan_id` IS NULL) <> (`creator_id` IS NULL)
      AND `produk_id` IS NULL AND `pesanan_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `anggota_percakapan` (
  `id`              VARCHAR(40) NOT NULL,
  `percakapan_id`   VARCHAR(40) NOT NULL,
  `user_tipe`       VARCHAR(20) NOT NULL COMMENT 'pelanggan|creator|admin',
  `user_id`         VARCHAR(40) NOT NULL COMMENT 'id sesuai user_tipe; admin.id disimpan sebagai string',
  `peran`           VARCHAR(20) NOT NULL COMMENT 'penjualan: pembeli|penjual; cs: pengguna|cs (diisi aplikasi dari sesi terverifikasi)',
  `bergabung_pada`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `keluar_pada`     DATETIME NULL DEFAULT NULL COMMENT 'NULL=masih anggota; alih CS lama diisi, bila ditugaskan lagi cukup di-NULL-kan',
  `terakhir_baca_pada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  -- Satu baris per (percakapan, pengguna): cegah keanggotaan ganda.
  -- Pembacaan & pengiriman pesan hanya untuk baris keluar_pada IS NULL.
  -- Pengalihan petugas CS TIDAK menghapus baris riwayat pesan: cukup
  --   tandai keluar_pada petugas lama + tambah baris petugas baru.
  UNIQUE KEY `uniq_anggota` (`percakapan_id`, `user_tipe`, `user_id`),
  KEY `idx_anggota_user` (`user_tipe`, `user_id`),
  CONSTRAINT `fk_anggota_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_anggota_tipe` CHECK (`user_tipe` IN ('pelanggan','creator','admin')),
  CONSTRAINT `chk_anggota_peran` CHECK (`peran` IN ('pembeli','penjual','pengguna','cs'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pesan` (
  `id`              VARCHAR(40) NOT NULL,
  `percakapan_id`   VARCHAR(40) NOT NULL,
  `pengirim_tipe`   VARCHAR(20) NOT NULL COMMENT 'pelanggan|creator|admin',
  `pengirim_id`     VARCHAR(40) NOT NULL COMMENT 'id sesuai pengirim_tipe; admin.id sebagai string',
  `teks`            TEXT NULL COMMENT 'isi pesan; NULL hanya untuk pesan lampiran/sistem',
  `tipe`            VARCHAR(20) NOT NULL DEFAULT 'teks' COMMENT 'teks|gambar|file|sistem',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada`     DATETIME NULL DEFAULT NULL COMMENT 'edit pesan',
  `dihapus_pada`    DATETIME NULL DEFAULT NULL COMMENT 'hapus logis',
  PRIMARY KEY (`id`),
  -- Pagination: WHERE percakapan_id=? AND (dibuat_pada,id) < (?,?).
  KEY `idx_pesan_percakapan_kirim` (`percakapan_id`, `dibuat_pada`, `id`),
  KEY `idx_pesan_pengirim` (`pengirim_tipe`, `pengirim_id`),
  CONSTRAINT `fk_pesan_percakapan`
    FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Otorisasi kirim di level DB: pengirim WAJIB punya baris keanggotaan
  -- pada percakapan yang sama. Pembacaan juga wajib difilter aplikasi
  -- lewat anggota_percakapan (keluar_pada IS NULL); peran CS diambil dari
  -- admin.peran terverifikasi, bukan dari frontend.
  -- Catatan: DELETE baris anggota ikut menghapus pesan orang tsb (CASCADE)
  --   — alih petugas CS cukup isi keluar_pada; JANGAN hapus baris anggota.
  CONSTRAINT `fk_pesan_pengirim_anggota`
    FOREIGN KEY (`percakapan_id`, `pengirim_tipe`, `pengirim_id`)
    REFERENCES `anggota_percakapan` (`percakapan_id`, `user_tipe`, `user_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_pesan_pengirim` CHECK (`pengirim_tipe` IN ('pelanggan','creator','admin')),
  CONSTRAINT `chk_pesan_isi` CHECK (`teks` IS NOT NULL OR `tipe` <> 'teks')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  ) STORED,  -- NULL implisit di MySQL & MariaDB (klause trailing NULL ditolak MariaDB)
  `selesai`           TINYINT(1) GENERATED ALWAYS AS (
    CASE
      WHEN `durasi_detik` IS NULL OR `durasi_detik` = 0 THEN 0
      WHEN `posisi_detik` >= (`durasi_detik` * 0.9) THEN 1
      ELSE 0
    END
  ) STORED,  -- selalu 0/1 (tak pernah NULL); tanpa NOT NULL trailing agar sah di MySQL & MariaDB
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

-- ---------- Pembayaran (final: modul G — Model A satu baris per pesanan) ----------
-- Retry memakai kode_idempotensi SAMA via INSERT...ON DUPLICATE KEY UPDATE.
-- Riwayat callback dicatat di pembayaran_event. TANPA CVV/PIN/password.
CREATE TABLE IF NOT EXISTS `pembayaran` (
  `id`               VARCHAR(40) NOT NULL,
  `pesanan_id`       VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL COMMENT 'dibuat aplikasi per pesanan',
  `nominal`          BIGINT NOT NULL DEFAULT 0 COMMENT 'rupiah; >= 0',
  `mata_uang`        VARCHAR(10) NOT NULL DEFAULT 'IDR',
  `metode`           VARCHAR(60) NOT NULL DEFAULT '',
  `akun_pembayaran`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'TANPA PIN/CVV',
  `referensi`        VARCHAR(255) NULL DEFAULT NULL,
  `transaction_id`   VARCHAR(120) NULL DEFAULT NULL COMMENT 'ref gateway; normalkan ke NULL',
  `status`           VARCHAR(30) NOT NULL DEFAULT 'Menunggu konfirmasi',
  `dibuat_pada`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dikonfirmasi_pada` DATETIME NULL DEFAULT NULL,
  `gagal_pada`       DATETIME NULL DEFAULT NULL,
  `dikembalikan_pada` DATETIME NULL DEFAULT NULL,
  `nominal_refund`   BIGINT NOT NULL DEFAULT 0,
  `konfirmasi_admin` VARCHAR(60) NULL DEFAULT NULL,
  `catatan`          VARCHAR(255) NOT NULL DEFAULT '',
  `diperbarui_pada`  DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pembayaran_pesanan` (`pesanan_id`),
  UNIQUE KEY `uniq_pembayaran_idem` (`kode_idempotensi`),
  UNIQUE KEY `uniq_pembayaran_transaction` (`transaction_id`),
  KEY `idx_pembayaran_status` (`status`, `dibuat_pada`),
  CONSTRAINT `fk_pembayaran_pesanan`
    FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_pembayaran_nominal` CHECK (`nominal` >= 0),
  CONSTRAINT `chk_pembayaran_refund` CHECK (`nominal_refund` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pembayaran_event` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pembayaran_id`   VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL COMMENT 'key callback; duplikat=abaikan',
  `jenis`           VARCHAR(40) NOT NULL COMMENT 'buat|callback|retry|konfirmasi|gagal|refund',
  `status_saat_itu` VARCHAR(30) NULL DEFAULT NULL,
  `payload_ringkas` VARCHAR(500) NULL DEFAULT NULL COMMENT 'TANPA CVV/PIN/token',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_idem` (`pembayaran_id`, `kode_idempotensi`, `jenis`),
  KEY `idx_event_pembayaran` (`pembayaran_id`, `dibuat_pada`),
  CONSTRAINT `fk_event_pembayaran`
    FOREIGN KEY (`pembayaran_id`) REFERENCES `pembayaran` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Audit log generik (final: modul E; tanpa FK tipe-silang) ----------
-- Retensi 5 tahun (arsipkan, jangan DELETE ledger aktif tanpa kebijakan arsip).
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_tipe`       VARCHAR(20) NULL DEFAULT NULL COMMENT 'pelanggan|creator|admin',
  `user_id`         VARCHAR(40) NULL DEFAULT NULL COMMENT 'tanpa FK (tipe PK berbeda)',
  `jenis_aktivitas` VARCHAR(60) NOT NULL,
  `hasil`           VARCHAR(20) NOT NULL DEFAULT 'Berhasil' COMMENT 'Berhasil|Gagal|Ditolak',
  `target_table`    VARCHAR(60) NULL DEFAULT NULL,
  `target_id`       VARCHAR(100) NULL DEFAULT NULL,
  `teks`            VARCHAR(255) NOT NULL,
  `detail_json`     JSON NULL COMMENT 'TANPA password/token/PIN/CVV',
  `ikon`            VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  `warna`           VARCHAR(20) NOT NULL DEFAULT 'hijau',
  `alamat_ip`       VARCHAR(45) NULL DEFAULT NULL,
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_tipe`, `user_id`, `dibuat_pada`),
  KEY `idx_audit_jenis` (`jenis_aktivitas`, `dibuat_pada`),
  KEY `idx_audit_target` (`target_table`, `target_id`),
  KEY `idx_audit_dibuat` (`dibuat_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Relasi produk-media (final: modul D — banyak foto per produk) ----------
CREATE TABLE IF NOT EXISTS `produk_media` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `produk_id`       VARCHAR(40) NOT NULL,
  `media_id`        VARCHAR(40) NOT NULL,
  `urutan`          INT UNSIGNED NOT NULL DEFAULT 0,
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

SET FOREIGN_KEY_CHECKS = 1;
-- Skema selesai: impor satu kali via phpMyAdmin (menu Import). --

