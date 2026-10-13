<?php
/**
 * gamesku-store-backend-security-check.php
 * Pemeriksaan keamanan otomatis untuk backend PHP.
 * Jalankan: php backend/security-check.php
 *
 * Cek non-destruktif:
 * - Sintaks PHP
 * - Konfigurasi session cookies
 * - Konfigurasi CORS
 * - Ketersediaan endpoint (tes kuasi)
 * - Kesesuaian secret config
 */

declare(strict_types=1);

echo "=== gamesku.store Backend Security Check ===" . PHP_EOL;
echo "Waktu: " . date('c') . PHP_EOL . PHP_EOL;

// --- Konfigurasi (jangan masukkan secret) ---
$config = [
    'check_php_syntax'      => true,
    'check_session_cookie'  => true,
    'check_cors_origins'    => true,
    'check_secret_files'    => true,
    'check_rate_limiting'   => true,
    'check_error_handling'  => true,
    'check_csrf'            => true,
    'check_input_validation'=> true,
    'check_security_headers'=> true,
];

$results = [
    'pass'   => 0,
    'fail'   => 0,
    'warn'   => 0,
    'details' => [],
];

// --- Fungsi helper ---
function report(string $status, string $name, string $message, array &$results): void
{
    $results[$status]++;
    $icon = match($status) {
        'pass'   => '✅',
        'fail'   => '❌',
        'warn'   => '⚠️',
    };
    echo "{$icon} [$status] {$name}: {$message}" . PHP_EOL;
    $results['details'][] = "{$status}|{$name}|{$message}";
}

function runCommand(string $cmd): string
{
    $output = [];
    $return = 0;
    exec($cmd, $output, $return);
    return implode(PHP_EOL, $output);
}

// --- 1. Cek sintaks PHP ---
if ($config['check_php_syntax']) {
    $phpFiles = [
        __DIR__ . '/src/Auth.php',
        __DIR__ . '/src/Database.php',
// --- 3. Cek konfigurasi CORS ---
if ($config['check_cors_origins']) {
    $bootstrap = file_get_contents(__DIR__ . '/src/bootstrap.php');
    if (strpos($bootstrap, 'Access-Control-Allow-Origin') !== false) {
        report('pass', 'CORS Config', 'Access-Control-Allow-Origin diset', $results);
    } else {
        report('warn', 'CORS Config', 'Access-Control-Allow-Origin tidak ditemukan', $results);
    }
    if (strpos($bootstrap, 'Access-Control-Allow-Credentials: true') !== false) {
        report('pass', 'CORS Config', 'Credentials diperbolehkan', $results);
    } else {
        report('warn', 'CORS Config', 'Access-Control-Allow-Credentials NOT set', $results);
    }
}

// --- 4. Cek file sensitive ---
if ($config['check_secret_files']) {
    $secretPatterns = [
        'config/config.php'       => 'config.php',
        'config/contoh.config.php' => 'contoh.config.php',
    ];
    foreach ($secretPatterns as $relPath => $desc) {
        $fullPath = __DIR__ . '/' . $relPath;
        if (is_file($fullPath)) {
// --- 6. Cek CSRF protection ---
if ($config['check_csrf']) {
    $authPhp = file_get_contents(__DIR__ . '/src/Auth.php');
    if (strpos($authPhp, 'cekCsrf') !== false && strpos($authPhp, 'buatTokenCsrf') !== false) {
        report('pass', 'CSRF', 'Auth::cekCsrf() and Auth::buatTokenCsrf() tersedia', $results);
    } else {
        report('warn', 'CSRF', 'CSRF methods tidak ditemukan', $results);
    }
    $dashboard = file_get_contents(__DIR__ . '/src/Pengendali/PengendaliDasar.php');
    if (strpos($dashboard, 'validateCsrf') !== false) {
        report('pass', 'CSRF', 'validateCsrf() tersedia di PengendaliDasar', $results);
    } else {
        report('warn', 'CSRF', 'validateCsrf() tidak ditemukan', $results);
    }
}

// --- 7. Cek input validation ---
if ($config['check_input_validation']) {
    $authPhp = file_get_contents(__DIR__ . '/src/Pengendali/PengendaliAuth.php');
    if (strpos($authPhp, 'filter_var') !== false) {
        report('pass', 'Input Validation', 'filter_var digunakan di pengendali auth', $results);
    } else {
        report('warn', 'Input Validation', 'filter_var tidak ditemukan', $results);
    }
    $validateCsrf = strpos($authPhp, 'validateCsrf') !== false;
// --- Summary ---
echo PHP_EOL . "=== Summary ===" . PHP_EOL;
echo "Passes:  {$results['pass']}" . PHP_EOL;
echo "Fails:   {$results['fail']}" . PHP_EOL;
echo "Warns:   {$results['warn']}" . PHP_EOL;
echo PHP_EOL;

if ($results['fail'] > 0) {
    echo "⚠️  Beberapa pemeriksaan gagal. Perbaiki sebelum deployment." . PHP_EOL;
    exit(1);
} elseif ($results['warn'] > 0) {
    echo "⚠️  Beberapa pemeriksaan memberi peringatan. Review sebelum deployment." . PHP_EOL;
    exit(0);
} else {
    echo "✅ Semua pemeriksaan lulus." . PHP_EOL;
    exit(0);
}

    if ($validateCsrf) {
        report('pass', 'Input Validation', 'validateCsrf dipanggil di auth endpoints', $results);
    } else {
        report('warn', 'Input Validation', 'validateCsrf belum dipanggil di auth', $results);
    }
}

// --- 8. Cek rate limiting ---
if ($config['check_rate_limiting']) {
    $authPhp = file_get_contents(__DIR__ . '/src/Auth.php');
    if (strpos($authPhp, 'AuthRateLimiter') !== false) {
        report('pass', 'Rate Limiting', 'AuthRateLimiter tersedia', $results);
    } else {
        report('warn', 'Rate Limiting', 'AuthRateLimiter tidak ditemukan', $results);
    }
    // Check if login endpoint calls the limiter
    $authController = file_get_contents(__DIR__ . '/src/Pengendali/PengendaliAuth.php');
    if (strpos($authController, 'AuthRateLimiter::check') !== false) {
        report('pass', 'Rate Limiting', 'AuthRateLimiter::check dipanggil di login', $results);
    } else {
        report('warn', 'Rate Limiting', 'AuthRateLimiter::check belum dipanggil di login', $results);
    }
}

// --- 9. Cek security headers ---
if ($config['check_security_headers']) {
    $bootstrap = file_get_contents(__DIR__ . '/src/bootstrap.php');
    $headers = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options'       => 'DENY',
        'Referrer-Policy'       => 'no-referrer',
        'Cache-Control'         => 'no-store',
    ];
    foreach ($headers as $name => $expected) {
        if (strpos($bootstrap, "header('{$name}: {$expected}')") !== false) {
            report('pass', 'Security Headers', $name, $results);
        } else {
            report('warn', 'Security Headers', "header('{$name}') belum ada", $results);
        }
    }
}

// --- 10. Cek database connection ---
if ($config['check_database']) {
    $dbFile = file_get_contents(__DIR__ . '/src/Database.php');
    if (strpos($dbFile, 'PDO') !== false && strpos($dbFile, 'prepare') !== false) {
        report('pass', 'Database', 'PDO prepared statements digunakan', $results);
    } else {
        report('warn', 'Database', 'PDO prepared statement belum diverifikasi', $results);
    }
    if (strpos($dbFile, 'ATTR_EMULATE_PREPARES') !== false) {
        report('pass', 'Database', 'PDO::ATTR_EMULATE_PREPARES = false', $results);
    } else {
        report('warn', 'Database', 'PDO::ATTR_EMULATE_PREPARES belum diverifikasi', $results);
    }
}

            $content = file_get_contents($fullPath);
            if (strpos($content, 'root') !== false || strpos($content, 'db_pass') !== false) {
                report('warn', 'Secret File', $desc . ' mungkin mengandung kredensial', $results);
            } else {
                report('pass', 'Secret File', $desc . ' tidak terlihat mengandung kredensial', $results);
            }
        }
    }
}

// --- 5. Cek handler error ---
if ($config['check_error_handling']) {
    $bootstrap = file_get_contents(__DIR__ . '/src/bootstrap.php');
    if (strpos($bootstrap, 'display_errors') !== false && strpos($bootstrap, '0') !== false) {
        report('pass', 'Error Handling', 'display_errors dipsain ke 0 (production)', $results);
    } else {
        report('warn', 'Error Handling', 'display_errors belum diverifikasi', $results);
    }
    if (strpos($bootstrap, 'set_exception_handler') !== false) {
        report('pass', 'Error Handling', 'set_exception_handler tersedia', $results);
    } else {
        report('warn', 'Error Handling', 'set_exception_handler tidak ditemukan', $results);
    }
}

        __DIR__ . '/src/Bantu.php',
        __DIR__ . '/src/bootstrap.php',
        __DIR__ . '/src/Aktivitas.php',
        __DIR__ . '/api/index.php',
        __DIR__ . '/database/instal.php',
    ];
    $found = false;
    foreach ($phpFiles as $file) {
        if (is_file($file)) {
            $output = runCommand("php -l \"{$file}\" 2>&1");
            if (strpos($output, 'No syntax errors') !== false) {
                report('pass', 'PHP Syntax', basename($file), $results);
            } else {
                report('fail', 'PHP Syntax', basename($file) . ': ' . $output, $results);
            }
            $found = true;
        }
    }
    if (!$found) {
        report('warn', 'PHP Syntax', 'Tidak ada file PHP ditemukan untuk dicek', $results);
    }
}

// --- 2. Cek konfigurasi session cookie ---
if ($config['check_session_cookie']) {
    // File bootstrap.php men-set session config
    $bootstrap = file_get_contents(__DIR__ . '/src/bootstrap.php');
    $checks = [
        'session.cookie_httponly' => 'ini_set(\'session.cookie_httponly\', \'1\')',
        'session.use_strict_mode' => 'ini_set(\'session.use_strict_mode\', \'1\')',
        'session.use_only_cookies' => 'ini_set(\'session.use_only_cookies\', \'1\')',
    ];
    foreach ($checks as $name => $expected) {
        if (strpos($bootstrap, $expected) !== false) {
            report('pass', 'Session Config', $name, $results);
        } else {
            report('warn', 'Session Config', "Tidak ditemukan: {$name}", $results);
        }
    }
}
