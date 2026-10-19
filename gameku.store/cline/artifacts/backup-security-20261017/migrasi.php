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
    echo "[1/2] Kolom pesanan.idempotency_key ditambahkan.\n";
} else {
    echo "[1/2] Kolom pesanan.idempotency_key sudah ada.\n";
}

if (!indeksAda($pdo, 'pesanan', 'uniq_pesanan_idempotency')) {
    $pdo->exec("ALTER TABLE `pesanan` ADD UNIQUE KEY `uniq_pesanan_idempotency` (`idempotency_key`)");
    echo "[2/2] Unique key uniq_pesanan_idempotency ditambahkan.\n";
} else {
    echo "[2/2] Unique key uniq_pesanan_idempotency sudah ada.\n";
}

echo "\nMigrasi selesai.\n";
