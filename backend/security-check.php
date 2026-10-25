<?php
// Pemeriksaan keamanan backend + lint sintaks PHP.
// Jalankan: php backend/security-check.php   (dari root repo)
//           php security-check.php           (dari folder backend)
//
// Tanpa dependensi eksternal. Exit code 1 bila ada pemeriksaan gagal.

declare(strict_types=1);

$base = __DIR__;

echo "=== gamesku.store Backend Security Check ===" . PHP_EOL;
echo "Waktu: " . date('c') . PHP_EOL . PHP_EOL . "Root: {$base}" . PHP_EOL . PHP_EOL;

$config = [
    'check_php_syntax'       => true,
    'check_session_cookie'   => true,
    'check_cors_origins'     => true,
    'check_secret_files'     => true,
    'check_error_handling'   => true,
    'check_csrf'             => true,
    'check_input_validation' => true,
    'check_rate_limiting'    => true,
    'check_security_headers' => true,
    'check_database'         => true,
];

$results = ['pass' => 0, 'fail' => 0, 'warn' => 0, 'details' => []];

function report(string $status, string $name, string $message, array &$results): void
{
    $results[$status]++;
    $ikon = match ($status) {
        'pass' => '[PASS]',
        'fail' => '[FAIL]',
        default => '[WARN]',
    };
    echo "{$ikon} {$name}: {$message}" . PHP_EOL;
    $results['details'][] = "{$status}|{$name}|{$message}";
}

function bacaFile(string $path): string
{
    return is_file($path) ? (string) file_get_contents($path) : '';
}

// ---------- 1. Sintaks PHP (php -l untuk semua berkas) ----------
if ($config['check_php_syntax']) {
    $targets = array_merge(
        glob(__DIR__ . '/src/*.php') ?: [],
        glob(__DIR__ . '/src/Pengendali/*.php') ?: [],
        glob(__DIR__ . '/api/*.php') ?: [],
        glob(__DIR__ . '/database/*.php') ?: [],
        glob(__DIR__ . '/security-service/**/*.php') ?: [],
        [__DIR__ . '/security-check.php'],
    );
    // Sertakan semua berkas PHP di security-service (rekursif).
    $ssDir = __DIR__ . '/security-service';
    if (is_dir($ssDir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ssDir));
        foreach ($it as $f) {
            if ($f->isFile() && $f->getExtension() === 'php') {
                $targets[] = $f->getPathname();
            }
        }
    }
    if (empty($targets)) {
        report('warn', 'PHP Syntax', 'Tidak ada berkas PHP ditemukan.', $results);
    }
    // Gunakan biner PHP yang sedang menjalankan skrip ini (PHP_BINARY) agar
    // tidak bergantung pada `php` yang ada di PATH.
    $biner = defined('PHP_BINARY') && PHP_BINARY !== '' ? PHP_BINARY : 'php';
    $lint = [];
    foreach ($targets as $file) {
        if (!is_file($file)) {
            continue;
        }
        $output = [];
        $code = 0;
        exec(escapeshellarg($biner) . ' -l ' . escapeshellarg($file) . ' 2>&1', $output, $code);
        $lint[] = $code === 0;
        if ($code !== 0) {
            report('fail', 'PHP Syntax', basename($file) . ': ' . trim(implode(' ', $output)), $results);
        }
    }
    $jumlahFile = count($lint);
    if ($jumlahFile > 0 && count(array_filter($lint)) === $jumlahFile) {
        report('pass', 'PHP Syntax', "{$jumlahFile} berkas lulus php -l", $results);
    }
}

// ---------- 2. Konfigurasi cookie sesi ----------
if ($config['check_session_cookie']) {
    $bootstrap = bacaFile(__DIR__ . '/src/bootstrap.php');
    $checks = [
        'session.cookie_httponly'  => "ini_set('session.cookie_httponly'",
        'session.use_strict_mode'  => "ini_set('session.use_strict_mode'",
        'session.use_only_cookies' => "ini_set('session.use_only_cookies'",
    ];
    foreach ($checks as $nama => $cuplik) {
        report(
            strpos($bootstrap, $cuplik) !== false ? 'pass' : 'warn',
            'Session Config',
            strpos($bootstrap, $cuplik) !== false ? $nama . ' aktif' : "Tidak ditemukan: {$nama}",
            $results
        );
    }
    // Cookie secure diambil dari ENV (Auth::cookieSecure) — cek keberadaannya.
    $auth = bacaFile(__DIR__ . '/src/Auth.php');
    report(
        strpos($auth, 'cookieSecure') !== false ? 'pass' : 'warn',
        'Session Config',
        strpos($auth, 'cookieSecure') !== false ? 'cookie Secure berbasis ENV tersedia' : 'cookie Secure tidak ditemukan',
        $results
    );
}

// ---------- 3. CORS ----------
if ($config['check_cors_origins']) {
    $bootstrap = bacaFile(__DIR__ . '/src/bootstrap.php');
    report(
        strpos($bootstrap, 'Access-Control-Allow-Origin') !== false ? 'pass' : 'warn',
        'CORS Config',
        strpos($bootstrap, 'Access-Control-Allow-Origin') !== false
            ? 'Access-Control-Allow-Origin diset dari whitelist'
            : 'Access-Control-Allow-Origin tidak ditemukan',
        $results
    );
    report(
        strpos($bootstrap, 'Access-Control-Allow-Credentials: true') !== false ? 'pass' : 'warn',
        'CORS Config',
        strpos($bootstrap, 'Access-Control-Allow-Credentials: true') !== false
            ? 'Credentials diperbolehkan hanya untuk origin tepercaya'
            : 'Access-Control-Allow-Credentials tidak diset',
        $results
    );
}

// ---------- 4. Berkas rahasia ----------
if ($config['check_secret_files']) {
    // config.php tidak boleh ter-commit (di-gitignore). Contoh config aman.
    $configPath = __DIR__ . '/config/config.php';
    if (is_file($configPath)) {
        report('pass', 'Secret File', 'config/config.php ada (lokal, di-gitignore)', $results);
    } else {
        report('warn', 'Secret File', 'config/config.php belum dibuat (salin dari contoh.config.php)', $results);
    }
    $contoh = bacaFile(__DIR__ . '/config/contoh.config.php');
    if ($contoh !== '' && stripos($contoh, 'db_pass') !== false && strpos($contoh, "'db_pass' => ''") === false) {
        report('warn', 'Secret File', 'contoh.config.php tampak berisi nilai db_pass non-kosong', $results);
    } else {
        report('pass', 'Secret File', 'contoh.config.php tanpa kredensial nyata', $results);
    }
}

// ---------- 5. Penanganan error ----------
if ($config['check_error_handling']) {
    $bootstrap = bacaFile(__DIR__ . '/src/bootstrap.php');
    report(
        strpos($bootstrap, "ini_set('display_errors', '0')") !== false ? 'pass' : 'warn',
        'Error Handling',
        'display_errors=0 untuk respons produksi',
        $results
    );
    report(
        strpos($bootstrap, 'set_exception_handler') !== false ? 'pass' : 'warn',
        'Error Handling',
        'set_exception_handler mengembalikan JSON',
        $results
    );
}

// ---------- 6. Proteksi CSRF ----------
if ($config['check_csrf']) {
    $auth = bacaFile(__DIR__ . '/src/Auth.php');
    $dasar = bacaFile(__DIR__ . '/src/Pengendali/PengendaliDasar.php');
    report(
        (strpos($auth, 'cekCsrf') !== false && strpos($auth, 'buatTokenCsrf') !== false) ? 'pass' : 'fail',
        'CSRF',
        'Auth::cekCsrf() + Auth::buatTokenCsrf() tersedia',
        $results
    );
    report(
        strpos($dasar, 'validateCsrf') !== false ? 'pass' : 'fail',
        'CSRF',
        'validateCsrf() tersedia di PengendaliDasar',
        $results
    );
}

// ---------- 7. Validasi input ----------
if ($config['check_input_validation']) {
    $authCtrl = bacaFile(__DIR__ . '/src/Pengendali/PengendaliAuth.php');
    $pelangganCtrl = bacaFile(__DIR__ . '/src/Pengendali/PengendaliPelanggan.php');
    report(
        strpos($authCtrl, 'filter_var') !== false ? 'pass' : 'warn',
        'Input Validation',
        'filter_var digunakan di pengendali auth',
        $results
    );
    report(
        (strpos($authCtrl, 'validateCsrf') !== false && strpos($pelangganCtrl, 'validateCsrf') !== false) ? 'pass' : 'warn',
        'Input Validation',
        'validateCsrf dipanggil pada endpoint state-changing',
        $results
    );
}

// ---------- 8. Rate limiting ----------
if ($config['check_rate_limiting']) {
    $auth = bacaFile(__DIR__ . '/src/Auth.php');
    $authCtrl = bacaFile(__DIR__ . '/src/Pengendali/PengendaliAuth.php');
    $pelangganCtrl = bacaFile(__DIR__ . '/src/Pengendali/PengendaliPelanggan.php');
    report(
        strpos($auth, 'class AuthRateLimiter') !== false ? 'pass' : 'warn',
        'Rate Limiting',
        'AuthRateLimiter tersedia',
        $results
    );
    report(
        strpos($authCtrl, 'AuthRateLimiter::check') !== false ? 'pass' : 'warn',
        'Rate Limiting',
        'rate limit aktif pada login admin',
        $results
    );
    report(
        strpos($pelangganCtrl, "'masuk_pembeli'") !== false ? 'pass' : 'warn',
        'Rate Limiting',
        'rate limit aktif pada login pembeli',
        $results
    );
}

// ---------- 9. Header keamanan ----------
if ($config['check_security_headers']) {
    $bootstrap = bacaFile(__DIR__ . '/src/bootstrap.php');
    $headers = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Cache-Control', 'Content-Security-Policy'];
    foreach ($headers as $nama) {
        report(
            strpos($bootstrap, "header('{$nama}") !== false || strpos($bootstrap, "header(\"{$nama}") !== false ? 'pass' : 'warn',
            'Security Headers',
            "{$nama} diset",
            $results
        );
    }
}

// ---------- 10. Database ----------
if ($config['check_database']) {
    $db = bacaFile(__DIR__ . '/src/Database.php');
    report(
        (strpos($db, 'PDO') !== false && strpos($db, 'prepare') !== false) ? 'pass' : 'warn',
        'Database',
        'PDO prepared statement digunakan',
        $results
    );
    report(
        strpos($db, 'ATTR_EMULATE_PREPARES') !== false ? 'pass' : 'warn',
        'Database',
        'ATTR_EMULATE_PREPARES => false',
        $results
    );
}

// ---------- Ringkasan ----------
echo PHP_EOL . '=== Ringkasan ===' . PHP_EOL;
echo "Passes: {$results['pass']}" . PHP_EOL;
echo "Fails:  {$results['fail']}" . PHP_EOL;
echo "Warns:  {$results['warn']}" . PHP_EOL . PHP_EOL;

if ($results['fail'] > 0) {
    echo 'Ada pemeriksaan yang GAGAL. Perbaiki sebelum deployment.' . PHP_EOL;
    exit(1);
}
if ($results['warn'] > 0) {
    echo 'Ada peringatan. Tinjau sebelum deployment.' . PHP_EOL;
    exit(0);
}
echo 'Semua pemeriksaan lulus.' . PHP_EOL;
exit(0);
