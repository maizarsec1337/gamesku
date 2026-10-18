<?php
// Migrasi skema untuk instalasi yang sudah ada (idempoten & aman dijalankan ulang).
// Pakai: php database/migrasi.php
//
// Saat ini menambahkan:
//   1. pesanan.idempotency_key (+ unique key) — cegah pesanan ganda saat retry.

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

/**
 * Tambah kolom bila belum ada.
 */
function kolomAda(PDO $pdo, string $tabel, string $kolom): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->execute([$tabel, $kolom]);
    return (int) $stmt->fetchColumn() > 0;
}

/**
 * Indeks bila belum ada.
 */
function indeksAda(PDO $pdo, string $tabel, string $indeks): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
    );
    $stmt->execute([$tabel, $indeks]);
    return (int) $stmt->fetchColumn() > 0;
}

// 1. pesanan.idempotency_key
if (!kolomAda($pdo, 'pesanan', 'idempotency_key')) {
    $pdo->exec("ALTER TABLE `pesanan` ADD COLUMN `idempotency_key` VARCHAR(64) NULL DEFAULT NULL AFTER `catatan`");
    echo "[1/3] Kolom pesanan.idempotency_key ditambahkan.\n";
} else {
    echo "[1/3] Kolom pesanan.idempotency_key sudah ada.\n";
}

if (!indeksAda($pdo, 'pesanan', 'uniq_pesanan_idempotency')) {
    $pdo->exec("ALTER TABLE `pesanan` ADD UNIQUE KEY `uniq_pesanan_idempotency` (`idempotency_key`)");
    echo "[2/3] Unique key uniq_pesanan_idempotency ditambahkan.\n";
} else {
    echo "[2/3] Unique key uniq_pesanan_idempotency sudah ada.\n";
}

// 3. Tabel audit_log (jika belum ada — untuk instalasi sebelum audit_log ada di skema)
$tabelAuditAda = (int) $pdo->query(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'audit_log'"
)->fetchColumn() > 0;
if (!$tabelAuditAda) {
    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "[3/3] Tabel audit_log dibuat.\n";
} else {
    echo "[3/3] Tabel audit_log sudah ada.\n";
}

echo "\nMigrasi selesai.\n";
