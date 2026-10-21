<?php
// Installer database: buat database, jalankan skema.sql, buat admin default.

require_once __DIR__ . '/../src/Bantu.php';

$cfg = require __DIR__ . '/../config/config.php';

$opsi = ['pengguna' => 'admin', 'sandi' => '', 'nama' => 'Administrator', 'email' => ''];
foreach ($argv ?? [] as $arg) {
    if (strpos($arg, '--') === 0) {
        [$k, $v] = array_pad(explode('=', substr($arg, 2), 2), 2, '');
        if (array_key_exists($k, $opsi)) {
            $opsi[$k] = $v !== '' ? $v : $opsi[$k];
        }
    }
}

$host = $cfg['db_host'] ?? '127.0.0.1';
$port = $cfg['db_port'] ?? 3306;
$nama = $cfg['db_nama'] ?? 'gameku_store';
$user = $cfg['db_user'] ?? 'root';
$pass = $cfg['db_pass'] ?? '';

echo "== Instalasi database gamesku ==\n";
echo "Host: {$host}:{$port}  Database: {$nama}\n\n";

// Koneksi tanpa memilih database, untuk membuat database.
try {
    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "Gagal koneksi ke MySQL: " . $e->getMessage() . "\n");
    exit(1);
}

$pdo->exec("CREATE DATABASE IF NOT EXISTS `{$nama}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
echo "[1/3] Database '{$nama}' siap.\n";
$pdo->exec("USE `{$nama}`");

// Jalankan skema.sql.
$skema = file_get_contents(__DIR__ . '/schema.sql');
if ($skema === false) {
    fwrite(STDERR, "Berkas skema.sql tidak dapat dibaca.\n");
    exit(1);
}

// PDO tidak menjalankan banyak statement sekaligus untuk multi-query,
// jadi kita pecah berdasarkan tanda ';' di akhir baris.
$pernyataan = array_filter(array_map('trim', preg_split('/;\s*$/m', $skema)), fn($s) => $s !== '');
$jumlah = 0;
foreach ($pernyataan as $sql) {
    // Lewati baris komentar/ kosong murni.
    $bersih = trim(preg_replace('/^\s*--.*$/m', '', $sql));
    if ($bersih === '' || stripos($bersih, 'USE ') === 0 || stripos($bersih, 'CREATE DATABASE') === 0) {
        continue;
    }
    try {
        $pdo->exec($sql);
        $jumlah++;
    } catch (PDOException $e) {
        // Abaikan galat "sudah ada" agar idempoten.
        if (strpos($e->getMessage(), 'already exists') === false) {
            fwrite(STDERR, "Galat SQL: " . $e->getMessage() . "\n  Pada: " . substr(preg_replace('/\s+/', ' ', $sql), 0, 80) . "...\n");
        }
    }
}
echo "[2/3] Skema dijalankan ({$jumlah} pernyataan).\n";

// Buat admin default (jika belum ada).
$ada = $pdo->query("SELECT COUNT(*) FROM `admin`")->fetchColumn();
if ((int) $ada > 0 && !in_array('--paksa', $argv ?? [], true)) {
    echo "[3/3] Admin sudah ada ({$ada}). Lewati pembuatan admin default.\n";
    echo "       (pakai --paksa untuk menambah admin baru walau sudah ada.)\n";
} else {
    // Sandi: pakai yang diberikan, atau buat acak kuat (dicetak SEKALI di sini).
    $sandiDiberikan = trim((string) $opsi['sandi']) !== '';
    if ($sandiDiberikan && strlen((string) $opsi['sandi']) < 8) {
        fwrite(STDERR, "[WARNING] Sandi yang diberikan kurang dari 8 karakter.\n");
    }
    $sandi = $sandiDiberikan ? (string) $opsi['sandi'] : bin2hex(random_bytes(9)); // 18 karakter

    $email = trim((string) $opsi['email']) !== '' ? trim((string) $opsi['email']) : ($opsi['pengguna'] . '@gamesku.store');

    $hash = password_hash($sandi, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare(
        "INSERT INTO `admin` (pengguna, nama, email, sandi_hash, status, peran)
         VALUES (?, ?, ?, ?, 'Aktif', 'superadmin')"
    );
    $stmt->execute([$opsi['pengguna'], $opsi['nama'], $email, $hash]);

    if ($sandiDiberikan) {
        fwrite(STDERR, "\n[WARNING] Sandi admin dibuat dari nilai yang Anda berikan.\n");
        fwrite(STDERR, "          Ganti segera setelah login pertama (endpoint /api/auth/admin/{id}).\n\n");
    } else {
        // Cetak SEKALI ke stdout agar bisa disalin admin. Tidak disimpan di mana pun.
        echo "\n";
        echo "  +--------------------------------------------------------------+\n";
        echo "  | Akun superadmin dibuat. Salin sandi ini SEKARANG (tidak      |\n";
        echo "  | ditampilkan lagi):                                           |\n";
        echo "  +--------------------------------------------------------------+\n";
        echo "    pengguna : {$opsi['pengguna']}\n";
        echo "    sandi    : {$sandi}\n";
        echo "  +--------------------------------------------------------------+\n";
        echo "  Simpan di pengelola sandi, lalu login dan ganti bila perlu.\n\n";
    }
}

echo "\nSelesai. Untuk menjalankan backend (dari folder project):\n";
echo "  php -S localhost:8000 -t backend backend/api/index.php\n";
echo "Atau dari folder backend/:  php -S localhost:8000 -t . api/index.php\n";
echo "Cek kesehatan:  http://localhost:8000/api/sehat\n";
