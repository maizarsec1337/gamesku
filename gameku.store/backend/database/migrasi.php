<?php
// Runner migrasi skema berversi untuk gamesku.store.
// Pakai: php database/migrasi.php
//
// Prinsip:
//   - ADDITIVE ONLY  : hanya CREATE TABLE / ADD COLUMN / ADD INDEX.
//   - NON-DESTRUKTIF : tidak ada DROP TABLE / DROP COLUMN / TRUNCATE / DELETE.
//   - IDEMPOTEN      : dijalankan berkali-kali = no-op (dijaga INFORMATION_SCHEMA
//                      + tabel `schema_migrations`).
//   - AMAN PARSIAL   : tiap langkah dicek keberadaannya sebelum dijalankan,
//                      sehingga eksekusi ulang tidak berhenti karena "duplicate".
//
// Catatan: MySQL 5.7 mengabaikan CHECK constraint; validasi tetap di aplikasi.

require_once __DIR__ . '/../src/Bantu.php';

$cfg = require __DIR__ . '/../config/config.php';

$host = $cfg['db_host'] ?? '127.0.0.1';
$port = $cfg['db_port'] ?? 3306;
$nama = $cfg['db_nama'] ?? 'gameku_store';
$user = $cfg['db_user'] ?? 'root';
$pass = $cfg['db_pass'] ?? '';

try {
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$nama};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "Gagal koneksi ke MySQL: " . $e->getMessage() . "\n");
    exit(1);
}

echo "== Migrasi skema gamesku ==\n";
echo "Database: {$nama} @ {$host}:{$port}\n\n";

// ============================ Helper pemeriksa ============================

function tabelAda(PDO $pdo, string $tabel): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?'
    );
    $stmt->execute([$tabel]);
    return (int) $stmt->fetchColumn() > 0;
}

function kolomAda(PDO $pdo, string $tabel, string $kolom): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->execute([$tabel, $kolom]);
    return (int) $stmt->fetchColumn() > 0;
}

function indeksAda(PDO $pdo, string $tabel, string $indeks): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
    );
    $stmt->execute([$tabel, $indeks]);
    return (int) $stmt->fetchColumn() > 0;
}

// Tambah kolom bila belum ada. Mengembalikan true bila diubah.
function tambahKolom(PDO $pdo, string $tabel, string $kolom, string $definisi, string $posisi = ''): bool
{
    if (!tabelAda($pdo, $tabel) || kolomAda($pdo, $tabel, $kolom)) {
        return false;
    }
    $pdo->exec("ALTER TABLE `{$tabel}` ADD COLUMN `{$kolom}` {$definisi} {$posisi}");
    return true;
}

// Tambah indeks biasa bila belum ada. Mengembalikan true bila diubah.
function tambahIndeks(PDO $pdo, string $tabel, string $nama, string $kolom): bool
{
    if (!tabelAda($pdo, $tabel) || indeksAda($pdo, $tabel, $nama)) {
        return false;
    }
    $pdo->exec("ALTER TABLE `{$tabel}` ADD INDEX `{$nama}` ({$kolom})");
    return true;
}

// Tambah unique key bila belum ada.
function tambahUnik(PDO $pdo, string $tabel, string $nama, string $kolom): bool
{
    if (!tabelAda($pdo, $tabel) || indeksAda($pdo, $tabel, $nama)) {
        return false;
    }
    $pdo->exec("ALTER TABLE `{$tabel}` ADD UNIQUE KEY `{$nama}` ({$kolom})");
    return true;
}

// ============================ Tabel migrasi ============================

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS `schema_migrations` (
        `versi` VARCHAR(20) NOT NULL,
        `deskripsi` VARCHAR(160) NOT NULL DEFAULT "",
        `dijalankan_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`versi`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

function sudahDijalankan(PDO $pdo, string $versi): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM `schema_migrations` WHERE versi = ?');
    $stmt->execute([$versi]);
    return (int) $stmt->fetchColumn() > 0;
}

function catatMigrasi(PDO $pdo, string $versi, string $deskripsi): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO `schema_migrations` (versi, deskripsi) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE deskripsi = VALUES(deskripsi)'
    );
    $stmt->execute([$versi, $deskripsi]);
}

/**
 * Daftar migrasi. Setiap entri: [versi, deskripsi, callable(PDO): array_ringkasan].
 * callable harus IDEMPOTEN dan mengembalikan daftar perubahan yang dilakukan.
 */
$migrasi = [];

// M1 — idempotency pesanan.
$migrasi[] = ['M1', 'pesanan.idempotency_key + unique', function (PDO $pdo): array {
    $ubah = [];
    if (tambahKolom($pdo, 'pesanan', 'idempotency_key', 'VARCHAR(64) NULL DEFAULT NULL', 'AFTER `catatan`')) {
        $ubah[] = 'ADD pesanan.idempotency_key';
    }
    if (tambahUnik($pdo, 'pesanan', 'uniq_pesanan_idempotency', '`idempotency_key`')) {
        $ubah[] = 'ADD UNIQUE uniq_pesanan_idempotency';
    }
    return $ubah;
}];

// M2 — audit_log.
$migrasi[] = ['M2', 'tabel audit_log', function (PDO $pdo): array {
    if (tabelAda($pdo, 'audit_log')) {
        return [];
    }
    $pdo->exec("
        CREATE TABLE `audit_log` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    return ['CREATE TABLE audit_log'];
}];

// M3 — media: kolom baru + tabel produk_media.
$migrasi[] = ['M3', 'media kolom tambahan + produk_media', function (PDO $pdo): array {
    $ubah = [];
    $kolom = [
        'owner_tipe'     => 'VARCHAR(20) NULL DEFAULT NULL',
        'owner_id'       => 'VARCHAR(40) NULL DEFAULT NULL',
        'nama_asli'      => 'VARCHAR(200) NULL DEFAULT NULL',
        'nama_simpan'    => 'VARCHAR(255) NULL DEFAULT NULL',
        'ekstensi'       => 'VARCHAR(20) NULL DEFAULT NULL',
        'checksum'       => 'VARCHAR(64) NULL DEFAULT NULL',
        'status'         => "VARCHAR(20) NOT NULL DEFAULT 'Aktif'",
        'object_key'     => 'VARCHAR(255) NULL DEFAULT NULL',
        'dibuat_pada'    => 'DATETIME NULL DEFAULT NULL',
        'diperbarui_pada'=> 'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP',
        'dihapus_pada'   => 'DATETIME NULL DEFAULT NULL',
    ];
    foreach ($kolom as $nama => $def) {
        if (tambahKolom($pdo, 'media', $nama, $def)) {
            $ubah[] = "ADD media.{$nama}";
        }
    }
    if (!tabelAda($pdo, 'produk_media')) {
        $pdo->exec("
            CREATE TABLE `produk_media` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE produk_media';
    }
    return $ubah;
}];

// M4 — tabel percakapan/pesan.
$migrasi[] = ['M4', 'tabel percakapan, anggota, pesan, lampiran, baca', function (PDO $pdo): array {
    $ubah = [];
    if (!tabelAda($pdo, 'percakapan')) {
        $pdo->exec("
            CREATE TABLE `percakapan` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE percakapan';
    }
    if (!tabelAda($pdo, 'anggota_percakapan')) {
        $pdo->exec("
            CREATE TABLE `anggota_percakapan` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE anggota_percakapan';
    }
    if (!tabelAda($pdo, 'pesan')) {
        $pdo->exec("
            CREATE TABLE `pesan` (
              `id` VARCHAR(40) NOT NULL,
              `percakapan_id` VARCHAR(40) NOT NULL,
              `pengirim_tipe` VARCHAR(20) NOT NULL,
              `pengirim_id` VARCHAR(40) NOT NULL,
              `teks` TEXT NULL,
              `tipe` VARCHAR(20) NOT NULL DEFAULT 'teks',
              `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `diubah_pada` DATETIME NULL DEFAULT NULL,
              `dihapus_pada` DATETIME NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_pesan_percakapan_kirim` (`percakapan_id`, `dibuat_pada`, `id`),
              KEY `idx_pesan_pengirim` (`pengirim_tipe`, `pengirim_id`),
              CONSTRAINT `fk_pesan_percakapan`
                FOREIGN KEY (`percakapan_id`) REFERENCES `percakapan` (`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE pesan';
    }
    if (!tabelAda($pdo, 'pesan_lampiran')) {
        $pdo->exec("
            CREATE TABLE `pesan_lampiran` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE pesan_lampiran';
    }
    if (!tabelAda($pdo, 'pesan_baca')) {
        $pdo->exec("
            CREATE TABLE `pesan_baca` (
              `pesan_id` VARCHAR(40) NOT NULL,
              `user_tipe` VARCHAR(20) NOT NULL,
              `user_id` VARCHAR(40) NOT NULL,
              `dibaca_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`pesan_id`, `user_tipe`, `user_id`),
              KEY `idx_baca_user` (`user_tipe`, `user_id`, `dibaca_pada`),
              CONSTRAINT `fk_baca_pesan`
                FOREIGN KEY (`pesan_id`) REFERENCES `pesan` (`id`)
                ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE pesan_baca';
    }
    return $ubah;
}];

// M5 — tabel pembayaran + event.
$migrasi[] = ['M5', 'tabel pembayaran + pembayaran_event', function (PDO $pdo): array {
    $ubah = [];
    if (!tabelAda($pdo, 'pembayaran')) {
        $pdo->exec("
            CREATE TABLE `pembayaran` (
              `id` VARCHAR(40) NOT NULL,
              `pesanan_id` VARCHAR(40) NOT NULL,
              `kode_idempotensi` VARCHAR(64) NOT NULL,
              `nominal` BIGINT NOT NULL DEFAULT 0,
              `mata_uang` VARCHAR(10) NOT NULL DEFAULT 'IDR',
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE pembayaran';
    }
    if (!tabelAda($pdo, 'pembayaran_event')) {
        $pdo->exec("
            CREATE TABLE `pembayaran_event` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $ubah[] = 'CREATE TABLE pembayaran_event';
    }
    return $ubah;
}];

// M6 — riwayat_tontonan.
$migrasi[] = ['M6', 'tabel riwayat_tontonan', function (PDO $pdo): array {
    if (tabelAda($pdo, 'riwayat_tontonan')) {
        return [];
    }
    $pdo->exec("
        CREATE TABLE `riwayat_tontonan` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    return ['CREATE TABLE riwayat_tontonan'];
}];

// M7 — index tambahan (guard INFORMATION_SCHEMA).
$migrasi[] = ['M7', 'index tambahan', function (PDO $pdo): array {
    $ubah = [];
    $daftar = [
        ['produk',    'idx_produk_jenis_status',        '`jenis`, `status`'],
        ['pelanggan', 'idx_pelanggan_username',         '`username`'],
        ['pelanggan', 'idx_pelanggan_status_bergabung', '`status`, `bergabung`'],
        ['pesanan',   'idx_pesanan_email',              '`email`'],
        ['media',     'idx_media_owner',                '`owner_tipe`, `owner_id`'],
        ['media',     'idx_media_owner_jenis',          '`owner_tipe`, `owner_id`, `jenis`'],
        ['media',     'idx_media_dibuat',               '`dibuat_pada`'],
        ['media',     'idx_media_status',               '`status`'],
    ];
    foreach ($daftar as [$tabel, $nama, $kolom]) {
        if (tambahIndeks($pdo, $tabel, $nama, $kolom)) {
            $ubah[] = "ADD INDEX {$nama}";
        }
    }
    return $ubah;
}];

// M8 — timestamp pesanan_item.
$migrasi[] = ['M8', 'timestamp pesanan_item', function (PDO $pdo): array {
    $ubah = [];
    if (tambahKolom($pdo, 'pesanan_item', 'dibuat_pada', 'DATETIME NULL DEFAULT NULL')) {
        $ubah[] = 'ADD pesanan_item.dibuat_pada';
    }
    if (tambahKolom($pdo, 'pesanan_item', 'diperbarui_pada', 'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP')) {
        $ubah[] = 'ADD pesanan_item.diperbarui_pada';
    }
    return $ubah;
}];

// M9 — tabel reseller_pengajuan (pendaftaran reseller pelanggan).
$migrasi[] = ['M9', 'tabel reseller_pengajuan', function (PDO $pdo): array {
    if (tabelAda($pdo, 'reseller_pengajuan')) {
        return [];
    }
    $pdo->exec("
        CREATE TABLE `reseller_pengajuan` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    return ['CREATE TABLE reseller_pengajuan'];
}];

// ============================ Jalankan ============================

$totalUbah = 0;
foreach ($migrasi as [$versi, $deskripsi, $kerja]) {
    if (sudahDijalankan($pdo, $versi)) {
        echo "[{$versi}] sudah tercatat — dilewati ({$deskripsi}).\n";
        continue;
    }
    try {
        $ubah = $kerja($pdo);
        catatMigrasi($pdo, $versi, $deskripsi);
        $totalUbah += count($ubah);
        if ($ubah === []) {
            echo "[{$versi}] tidak ada perubahan (skema sudah sesuai) — dicatat.\n";
        } else {
            echo "[{$versi}] diterapkan: " . implode(', ', $ubah) . "\n";
        }
    } catch (Throwable $e) {
        fwrite(STDERR, "[{$versi}] GAGAL: " . $e->getMessage() . "\n");
        fwrite(STDERR, "       Migrasi dihentikan. Perbaiki lalu jalankan ulang (idempoten).\n");
        exit(1);
    }
}

echo "\nMigrasi selesai. Total perubahan: {$totalUbah}.\n";
