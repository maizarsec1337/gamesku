<?php
// Bootstrap: konfigurasi global, autoload, header/CORS, sesi, dan rate limiting.

// Keamanan session global.
ini_set('session.cookie_httponly', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cache_limiter', 'nocache');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../logs/error.log');

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

// Autoload kelas di src/ dan src/Pengendali/.
spl_autoload_register(function ($kelas) {
    $jalur = [
        __DIR__ . '/' . $kelas . '.php',
        __DIR__ . '/Pengendali/' . $kelas . '.php',
    ];
    foreach ($jalur as $berkas) {
        if (is_file($berkas)) {
            require_once $berkas;
            return;
        }
    }
});

// Header dasar.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-XSS-Protection: 1; mode=block');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

// CORS.
$cfg = require __DIR__ . '/../config/config.php';
$asal = $_SERVER['HTTP_ORIGIN'] ?? '';
$izinkan = $cfg['cors_origins'] ?? [];
if ($asal !== '' && in_array($asal, $izinkan, true)) {
    header('Access-Control-Allow-Origin: ' . $asal);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override, X-Requested-With, X-CSRF-Token');
    header('Access-Control-Max-Age: 86400');
    // Batas ukuran request: 256 KB JSON, 8 MB multipart.
    $sizeLimit = 262144;
    if (array_key_exists('CONTENT_LENGTH', $_SERVER)) {
        $size = (int) $_SERVER['CONTENT_LENGTH'];
        if ($size > $sizeLimit) {
            Bantu::gagal('Ukuran request melebihi batas '.$sizeLimit.' bytes.', 413);
        }
    }
}

// Balas preflight CORS.
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Rate limiting middleware.
// $jalur dipakai di bawah ini tetapi baru dihitung oleh api/index.php SETELAH
// bootstrap ini selesai — hitung dulu di sini (dengan normalisasi yang sama)
// agar rate limiting memakai jalur sesungguhnya dan tidak memunculkan warning.
if (!isset($jalur)) {
    $jalur = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $jalur = preg_replace('#^/api#', '', $jalur) ?? '/';
    $jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
    $jalur = '/' . trim($jalur, '/');
}
$rateLimiterCfg = $cfg['rate_limiting'] ?? [];
$rateLimitEnabled = $rateLimiterCfg['enabled'] ?? false;
$rateLimitPaths = $rateLimiterCfg['paths'] ?? [];
$rateLimitKeys = $rateLimiterCfg['keys'] ?? ['ip'];
$rateLimits = $rateLimiterCfg['limits'] ?? [
    'default'  => 60,
    'sensitive' => 30,
    'login'    => 10,
    'write'    => 20,
];
$rateWindow = $rateLimiterCfg['window_seconds'] ?? 60;

if ($rateLimitEnabled && !in_array($jalur, ['/', '/sehat'], true)) {
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = $remoteAddr;
    foreach ($rateLimitKeys as $k) {
        if ($k === 'ip+path' && $jalur !== '/') {
            $key .= ':' . $jalur;
        } elseif ($k === 'session' && session_status() === PHP_SESSION_ACTIVE) {
            $key = session_id() . ':' . $remoteAddr;
        }
    }
    $store = &$_SESSION['_rate_limit'] ?? null;
    if (!is_array($store)) {
        $store = [];
    }
    $hits = $store[$key] ?? null;
    $now = time();
    if (!is_array($hits) || !isset($hits['window_start']) || $now - $hits['window_start'] > $rateWindow) {
        $hits = ['count' => 0, 'window_start' => $now];
    }
    $hits['count']++;
    $store[$key] = $hits;
    $_SESSION['_rate_limit'] = $store;

    $isSensitive = in_array($jalur, $rateLimitPaths['sensitive'] ?? [], true);
    $isWrite     = in_array($jalur, $rateLimitPaths['write'] ?? [], true);
    $limit = $rateLimits['default'];
    if (strpos($jalur, '/auth/masuk') !== false) {
        $limit = $rateLimits['login'];
    } elseif ($isWrite) {
        $limit = $rateLimits['write'];
    } elseif ($isSensitive) {
        $limit = $rateLimits['sensitive'];
    }
    if ($hits['count'] > $limit) {
        Bantu::gagal('Terlalu banyak permintaan. Coba lagi nanti.', 429);
    }
}

// Handler error global -> respons JSON.
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    error_log('[gameku] ' . $e->getMessage());
    echo json_encode([
        'ok'    => false,
        'pesan' => 'Terjadi kesalahan pada server.',
        'debug' => getenv('GAMEKU_DEBUG') ? ['message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()] : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

// Sesi disiapkan agar status login admin terbaca di semua endpoint.
Auth::mulai();

// Token CSRF dari session.
if (session_status() === PHP_SESSION_ACTIVE && !isset($_SESSION['_csrf_token'])) {
    $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
}
