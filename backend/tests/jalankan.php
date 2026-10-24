<?php
// Runner pengujian backend (tanpa dependensi / PHPUnit).
// Pakai: php backend/tests/jalankan.php
//
// Uji statis (Bantu/Kecil/RateLimiter/skema) selalu berjalan.
// Uji HTTP (uji_keamanan.php) hanya berjalan bila env GAMEKU_TEST_BASE diisi,
// mis. GAMEKU_TEST_BASE=http://localhost:8000

declare(strict_types=1);

require_once __DIR__ . '/../src/Bantu.php';
require_once __DIR__ . '/../src/Kecil.php';
require_once __DIR__ . '/../src/SecurityLog.php';
require_once __DIR__ . '/../src/RateLimiter.php';

$GLOBALS['__lulus'] = 0;
$GLOBALS['__gagal'] = 0;
$GLOBALS['__grup']  = '';

function grup(string $nama): void
{
    $GLOBALS['__grup'] = $nama;
    echo PHP_EOL . "== {$nama} ==" . PHP_EOL;
}

function uji(string $nama, callable $fn): void
{
    try {
        $fn();
        $GLOBALS['__lulus']++;
        echo "  [PASS] {$nama}" . PHP_EOL;
    } catch (Throwable $e) {
        $GLOBALS['__gagal']++;
        echo "  [FAIL] {$nama}: " . $e->getMessage() . PHP_EOL;
    }
}

function tegaskan(bool $kondisi, string $pesan = ''): void
{
    if (!$kondisi) {
        throw new RuntimeException($pesan !== '' ? $pesan : 'Asersi gagal');
    }
}

function sama($diharapkan, $dapat, string $pesan = ''): void
{
    if ($diharapkan !== $dapat) {
        $h = var_export($diharapkan, true);
        $d = var_export($dapat, true);
        throw new RuntimeException($pesan !== '' ? "{$pesan} (diharapkan {$h}, dapat {$d})" : "diharapkan {$h}, dapat {$d}");
    }
}

echo '=== Uji Backend gamesku.store ===' . PHP_EOL;

require __DIR__ . '/uji_bantu.php';
require __DIR__ . '/uji_rate_limiter.php';
require __DIR__ . '/uji_skema.php';
require __DIR__ . '/uji_keamanan.php';

echo PHP_EOL . '=== Ringkasan ===' . PHP_EOL;
echo "Lulus: {$GLOBALS['__lulus']}" . PHP_EOL;
echo "Gagal: {$GLOBALS['__gagal']}" . PHP_EOL;

exit($GLOBALS['__gagal'] > 0 ? 1 : 0);
