-- ============================================================
-- V4__pembayaran_and_audit_log.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: CREATE TABLE IF NOT EXISTS + ALTER guard. Run kedua = no-op.
-- Perbaikan dari review:
--   F-V4-01: model idempotency DIPUTUSKAN = Model A (satu pembayaran per
--     pesanan; retry memakai key SAMA via INSERT...ON DUPLICATE KEY UPDATE
--     di aplikasi, BUKAN baris baru). UNIQUE(pesanan_id) dipertahankan dan
--     didokumentasikan. Riwayat percobaan dicatat di pembayaran_event.
--   F-V4-02: kode_idempotensi NOT NULL + UNIQUE (NULL boleh duplikat,
--     jadi NOT NULL wajib agar proteksi nyata).
--   F-V4-03: transaction_id dinormalkan: aplikasi wajib ubah '' -> NULL
--     sebelum INSERT (UNIQUE mengizinkan banyak NULL, tapi '' dianggap sama).
--   F-V4-04: FK audit_log yang salah tipe DIHAPUS; diganti user_tipe+user_id
--     polimorfik TANPA FK + index.
--   F-V4-05: pembayaran memakai ON DELETE RESTRICT (bukti bayar tidak ikut
--     terhapus bila pesanan dihapus; tolak hapus pesanan berbayar).
--   F-V4-06: ejaan baku diperbarui_pada; JSON butuh 5.7+/10.2.7+.
-- Keamanan: TIDAK menyimpan CVV/PIN/password/kredensial. Hanya referensi.
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

-- 4.1 Pembayaran (satu baris per pesanan — Model A)
CREATE TABLE IF NOT EXISTS `pembayaran` (
  `id`               VARCHAR(40) NOT NULL,
  `pesanan_id`       VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL COMMENT 'dibuat aplikasi per pesanan; retry pakai key SAMA',
  `nominal`          BIGINT NOT NULL DEFAULT 0 COMMENT 'rupiah; >= 0',
  `mata_uang`        VARCHAR(10) NOT NULL DEFAULT 'IDR',
  `metode`           VARCHAR(60) NOT NULL DEFAULT '',
  `akun_pembayaran`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'rekening/identitas; TANPA PIN/CVV',
  `referensi`        VARCHAR(255) NULL DEFAULT NULL COMMENT 'label bank/vendor',
  `transaction_id`   VARCHAR(120) NULL DEFAULT NULL COMMENT 'ref gateway; '' dinormalkan ke NULL',
  `status`           VARCHAR(30) NOT NULL DEFAULT 'Menunggu konfirmasi'
                     COMMENT 'Menunggu konfirmasi|Dikonfirmasi|Lunas|Gagal|Dikembalikan|Kadaluarsa',
  `dibuat_pada`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dikonfirmasi_pada` DATETIME NULL DEFAULT NULL,
  `gagal_pada`       DATETIME NULL DEFAULT NULL,
  `dikembalikan_pada` DATETIME NULL DEFAULT NULL COMMENT 'refund; NULL = belum refund',
  `nominal_refund`   BIGINT NOT NULL DEFAULT 0 COMMENT '>= 0, <= nominal',
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
-- 4.2 Event/percobaan pembayaran (riwayat callback, webhook, retry)
--     Satu pembayaran boleh punya BANYAK event; tanpa batas UNIQUE pesanan.
CREATE TABLE IF NOT EXISTS `pembayaran_event` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pembayaran_id`   VARCHAR(40) NOT NULL,
  `kode_idempotensi` VARCHAR(64) NOT NULL COMMENT 'key callback; duplikat = abaikan',
  `jenis`           VARCHAR(40) NOT NULL COMMENT 'buat|callback|retry|konfirmasi|gagal|refund',
  `status_saat_itu` VARCHAR(30) NULL DEFAULT NULL,
  `payload_ringkas` VARCHAR(500) NULL DEFAULT NULL COMMENT 'ringkasan aman; TANPA CVV/PIN/token',
  `dibuat_pada`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_idem` (`pembayaran_id`, `kode_idempotensi`, `jenis`),
  KEY `idx_event_pembayaran` (`pembayaran_id`, `dibuat_pada`),
  CONSTRAINT `fk_event_pembayaran`
    FOREIGN KEY (`pembayaran_id`) REFERENCES `pembayaran` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.3 Audit log generik (tanpa FK tipe-silang; pelaku polimorfik + index)
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_tipe`       VARCHAR(20) NULL DEFAULT NULL COMMENT 'pelanggan|creator|admin',
  `user_id`         VARCHAR(40) NULL DEFAULT NULL COMMENT 'tanpa FK (tipe PK berbeda)',
  `jenis_aktivitas` VARCHAR(60) NOT NULL COMMENT 'login|logout|upload|edit|hapus|chat|beli|bayar|admin|keamanan',
  `hasil`           VARCHAR(20) NOT NULL DEFAULT 'Berhasil' COMMENT 'Berhasil|Gagal|Ditolak',
  `target_table`    VARCHAR(60) NULL DEFAULT NULL,
  `target_id`       VARCHAR(100) NULL DEFAULT NULL,
  `teks`            VARCHAR(255) NOT NULL,
  `detail_json`     JSON NULL COMMENT 'data aman saja; TANPA password/token/PIN/CVV',
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

-- ATURAN TRANSISI STATUS (ditegakkan aplikasi; dokumentasi untuk backend):
--   Menunggu konfirmasi -> Dikonfirmasi | Gagal | Kadaluarsa
--   Dikonfirmasi -> Lunas | Gagal
--   Lunas -> Dikembalikan (sebagian/penuh via nominal_refund)
--   Gagal/Kadaluarsa/Dikembalikan = final (TOLAK perubahan kecuali event koreksi admin).
-- RETRY IDEMPOTEN (aplikasi):
--   INSERT INTO pembayaran (...) VALUES (...)
--   ON DUPLICATE KEY UPDATE catatan = VALUES(catatan);
--   Bila kode_idempotensi sama -> baris sama dikembalikan, TIDAK ganda.
-- RETENSI: pembayaran + pembayaran_event + audit_log = 5 tahun (arsipkan,
--   jangan DELETE dari ledger aktif tanpa kebijakan arsip terpisah).
