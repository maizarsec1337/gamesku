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

// Integrasi security-service ke lifecycle backend.
require_once __DIR__ . '/../security-service/autoload.php';
if (class_exists('BackendIntegration')) {
    BackendIntegration::boot();
}

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

// Request ID: diset di awal agar setiap log & respons dapat ditelusuri.
Bantu::requestId();

// Header dasar.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
// Samakan dengan Bantu::json(): heuristik XSS lama dinonaktifkan (metode usang,
// dapat memicu bypass), CSP ketat di bawah adalah kontrol yang sebenarnya.
header('X-XSS-Protection: 0');
// API hanya mengembalikan JSON — larang memuat/mengeksekusi sumber apa pun.
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
// Header keamanan tambahan: cegah situs lain membuka API di frame/iframe.
header('Cross-Origin-Opener-Policy: same-origin');
// HSTS: hanya aktif jika HTTPS terdeteksi.
if (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'HTTPS')
) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
};
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

// CORS.
$cfg = require __DIR__ . '/../config/config.php';

// ===== Validasi environment saat startup (fail-fast untuk konfigurasi salah) =====
$isProduction = getenv('GAMEKU_ENV') === 'production';
$debugAktif   = getenv('GAMEKU_DEBUG') === '1';
if ($isProduction && $debugAktif) {
    // Debug aktif di produksi = kebocoran detail internal. Blokir + log.
    error_log('[gameku] KRITIS: GAMEKU_DEBUG=1 di mode production — nonaktifkan segera.');
    $debugAktif = false;
}
if ($isProduction) {
    // CORS produksi tidak boleh wildcard.
    foreach ($cfg['cors_origins'] ?? [] as $o) {
        if ($o === '*' || $o === 'null') {
            error_log('[gameku] KRITIS: cors_origins mengandung wildcard di mode production: ' . $o);
        }
    }
    // Cookie secure harus aktif di produksi.
    if (getenv('GAMEKU_SECURE_COOKIE') !== '1') {
        error_log('[gameku] PERINGATAN: GAMEKU_SECURE_COOKIE belum =1 di mode production (cookie bisa terkirim via HTTP).');
    }
}

$asal = $_SERVER['HTTP_ORIGIN'] ?? '';
$izinkan = $cfg['cors_origins'] ?? [];
if ($asal !== '' && in_array($asal, $izinkan, true)) {
    header('Access-Control-Allow-Origin: ' . $asal);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override, X-Requested-With, X-CSRF-Token');
    header('Access-Control-Max-Age: 86400');
}

// Batas ukuran request: 256 KB JSON / 8 MB multipart — berlaku untuk SEMUA request
// (bukan hanya yang Origin-nya cocok agar tidak bisa dibobol tanpa header Origin).
$sizeLimit = (int) ($cfg['request']['max_json_size'] ?? 262144);
if (array_key_exists('CONTENT_LENGTH', $_SERVER)) {
    $size = (int) $_SERVER['CONTENT_LENGTH'];
    if ($size > max($sizeLimit, (int) ($cfg['request']['max_upload_size'] ?? 8388608))) {
        SecurityLog::catat('permintaan_terlalu_besar', 'warn', 'Request body melebihi batas.', ['ukuran' => $size]);
        Bantu::gagal('Ukuran request melebihi batas.', 413);
    }
}

// Balas preflight CORS.
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Rate limiting middleware — berbasis FILE per-IP (bukan session) sehingga
// tetap membatasi meski penyerang tidak membawa cookie atau selalu mengganti session.
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
    $ip = RateLimiter::ip();
    $isSensitive = in_array($jalur, $rateLimitPaths['sensitive'] ?? [], true);
    $isWrite     = in_array($jalur, $rateLimitPaths['write'] ?? [], true);

    $limit = $rateLimits['default'];
    $bucket = 'default';
    if (strpos($jalur, '/auth/masuk') !== false) {
        $limit = $rateLimits['login'];
        $bucket = 'login';
    } elseif ($isWrite) {
        $limit = $rateLimits['write'];
        $bucket = 'write';
    } elseif ($isSensitive) {
        $limit = $rateLimits['sensitive'];
        $bucket = 'sensitive';
    }

    // Kunci: IP saja, atau IP+jalur bila dikonfigurasi (mis. per-endpoint).
    $kunci = $ip;
    if (in_array('ip+path', $rateLimitKeys ?? [], true) && $bucket !== 'login') {
        $kunci = $ip . '|' . $jalur;
    }

    $hasil = RateLimiter::check($bucket, $kunci, $limit, $rateWindow);
    if ($hasil['limited']) {
        header('Retry-After: ' . (int) $hasil['retry_after']);
        SecurityLog::catat('rate_limit', 'warn', 'Permintaan dibatasi rate limiter.', [
            'bucket' => $bucket,
            'limit'  => $limit,
            'retryAfter' => $hasil['retry_after'],
        ]);
        Bantu::gagal('Terlalu banyak permintaan. Coba lagi nanti.', 429);
    }

    // Bersihkan counter kadaluarsa sesekali (setiap ~100 request, probabilistik).
    if (random_int(1, 100) === 1) {
        RateLimiter::bersihkan();
    }
}

// Handler error global -> respons JSON (tanpa stack trace di respons produksi).
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    // Log lengkap ke server dengan request ID (file, baris) untuk penelusuran.
    error_log('[gameku][req=' . Bantu::requestId() . '] ' . $e->getMessage()
        . ' @ ' . $e->getFile() . ':' . $e->getLine());
    SecurityLog::catat('server_error', 'error', 'Exception tak tertangani.', [
        'pesan' => Bantu::potong($e->getMessage(), 300),
        'file'  => basename($e->getFile()),
        'line'  => $e->getLine(),
    ]);
    $balasan = [
        'ok'    => false,
        'pesan' => 'Terjadi kesalahan pada server.',
        'requestId' => Bantu::requestId(),
    ];
    // Debug detail HANYA bila GAMEKU_DEBUG=1 DAN bukan mode production
    // (validasi startup di atas sudah memaksa $debugAktif=false di production).
    global $debugAktif;
    if (!empty($debugAktif)) {
        $balasan['debug'] = ['message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()];
    }
    echo json_encode($balasan, JSON_UNESCAPED_UNICODE);
    exit;
});

// Sesi disiapkan agar status login admin terbaca di semua endpoint.
Auth::mulai();

// Token CSRF dari session.
if (session_status() === PHP_SESSION_ACTIVE && !isset($_SESSION['_csrf_token'])) {
    $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
}
