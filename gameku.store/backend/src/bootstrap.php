<?php
// =====================================================================
// bootstrap.php — dipersiapkan sebelum router menjalankan endpoint.
// Mengatur autoload kelas, header CORS, sesi, dan pelaporan error.
// =====================================================================

// --- Konfigurasi keamanan global ---
ini_set('session.cookie_httponly', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cache_limiter', 'nocache');
// Tidak boleh mengekspos detail exception di respons (hanya saat debug eksplisit).
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Pelaporan error: jangan bocorkan ke output saat produksi, tapi catat.
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

// --- Autoload kelas di src/ dan src/Pengendali/ ---
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

// --- Header dasar ---
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// --- CORS (dibutuhkan bila frontend memanggil backend lintas origin) ---
$cfg = require __DIR__ . '/../config/config.php';
$asal = $_SERVER['HTTP_ORIGIN'] ?? '';
$izinkan = $cfg['cors_origins'] ?? [];
if ($asal !== '' && in_array($asal, $izinkan, true)) {
    header('Access-Control-Allow-Origin: ' . $asal);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override, X-Requested-With, X-CSRF-Token');
    // Batas maksimum ukuran request (256 KB untuk API API JSON, 8 MB multipart).
    $sizeLimit = 262144;
    if (array_key_exists('CONTENT_LENGTH', $_SERVER)) {
        $size = (int) $_SERVER['CONTENT_LENGTH'];
        if ($size > $sizeLimit) {
            Bantu::gagal('Ukuran request melebihi batas '.$sizeLimit.' bytes.', 413);
        }
    }
}

// Balas preflight CORS dan berhenti.
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Handler error global -> respons JSON rapi ---
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    error_log('[gameku] ' . $e->getMessage());
    echo json_encode([
        'ok'    => false,
        'pesan' => 'Terjadi kesalahan pada server.',
        // Detail hanya saat mode debug eksplisit.
        'debug' => getenv('GAMEKU_DEBUG') ? $e->getMessage() : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

// Sesi selalu disiapkan agar status login admin terbaca di semua endpoint.
Auth::mulai();

// --- Akses ke token CSRF dari session ---
if (session_status() === PHP_SESSION_ACTIVE && !isset($_SESSION['_csrf_token'])) {
    $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
}
