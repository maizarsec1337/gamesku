<?php
// Jalankan TERPISAH: php tests/uji_pengendali_terisolasi.php.
// Double hanya di proses test; tidak memuat bootstrap/kredensial/database asli.
declare(strict_types=1);

class ResponsUji extends Exception
{
    public function __construct(public int $status, public mixed $data = null) { parent::__construct(); }
}
class Bantu
{
    public static function gagal(string $pesan, int $status = 400): never { throw new ResponsUji($status, $pesan); }
    public static function sukses(mixed $data = null, string $pesan = '', int $status = 200): never { throw new ResponsUji($status, $data); }
    public static function potong(string $teks, int $maks): string { return substr($teks, 0, $maks); }
    public static function hariIni(): string { return '2026-10-22'; }
    public static function nomorPesanan(): string { return 'QA-PESANAN'; }
    public static function idBaru(string $prefix): string { return $prefix . '-qa'; }
}
class Auth
{
    public static bool $admin = false;
    public static function sesi(): ?array { return self::$admin ? ['id' => 1] : null; }
}
class Aktivitas { public static function audit(...$args): void {} }
class SecurityLog { public static function catat(...$args): void {} }
class RateLimiter
{
    public static function ip(): string { return '127.0.0.1'; }
    public static function check(...$args): array { return ['limited' => false]; }
}
class Database
{
    public static string $statusProduk = 'Aktif';
    public static string $mode = '';
    public static int $bacaIdempotensi = 0;
    public static int $hargaProduk = 100;
    public static string $preview = '[]';
    public static array $tulisan = [];
    public static function satu(string $sql, array $params = []): ?array
    {
        if (str_contains($sql, 'idempotency_key')) {
            return ++self::$bacaIdempotensi > 1
                ? ['id' => 'QA-EXISTING', 'subtotal' => 100, 'biaya_layanan' => 1000, 'potongan' => 0, 'total' => 1100, 'status' => 'Menunggu'] : null;
        }
        if (str_contains($sql, 'FROM produk')) {
            if (str_contains($sql, 'AND status') && self::$statusProduk !== 'Aktif') return null;
            return ['id' => 'qa', 'nama' => 'Fixture test', 'status' => self::$statusProduk,
                'harga' => self::$hargaProduk, 'hargaDiskon' => 0, 'kategori_id' => null,
                'preview' => self::$preview, 'fileProduk' => '/uploads/fixture.zip'];
        }
        return null;
    }
    public static function eksekusi(string $sql, array $params = []): int
    {
        self::$tulisan[] = ['sql' => $sql, 'params' => $params];
        return 1;
    }
    public static function transaksi(callable $fn): mixed
    {
        if (self::$mode === 'race') throw new PDOException('Duplicate idempotency key', 23000);
        throw new RuntimeException('Kuota promo sudah habis.');
    }
}
require __DIR__ . '/../src/Pengendali/PengendaliDasar.php';
require __DIR__ . '/../src/Pengendali/PengendaliProduk.php';
require __DIR__ . '/../src/Pengendali/PengendaliPesanan.php';
require __DIR__ . '/../src/Pengendali/PengendaliUlasan.php';
require __DIR__ . '/../src/Pengendali/PengendaliPromo.php';

$gagal = 0;
function cek(string $nama, callable $aksi, int $status, ?string $id = null, ?callable $verifikasi = null): void
{
    global $gagal;
    try {
        $aksi();
        throw new Exception('Tidak ada respons');
    } catch (ResponsUji $e) {
        if ($e->status === $status && ($id === null || ($e->data['id'] ?? null) === $id)
            && ($verifikasi === null || $verifikasi($e->data))) {
            echo "PASS {$nama}\n";
            return;
        }
        $gagal++;
        echo "FAIL {$nama}: status {$e->status}\n";
    } catch (Throwable $e) {
        $gagal++;
        echo "FAIL {$nama}: " . $e->getMessage() . "\n";
    }
}
foreach (['Aktif' => 200, 'Draft' => 404, 'Nonaktif' => 404] as $status => $kode) {
    Database::$statusProduk = $status;
    cek("detail tamu {$status}", fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), $kode);
}
Auth::$admin = true;
Database::$statusProduk = 'Draft';
cek('admin masih dapat melihat Draft', fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), 200);
Database::$statusProduk = 'Aktif';
$controller = new PengendaliPesanan();
$property = new ReflectionProperty(PengendaliDasar::class, 'badan');
$property->setValue($controller, ['item' => [['produkId' => 'qa', 'jumlah' => 1]], 'idempotencyKey' => 'qa-key-123456']);
$checkout = new ReflectionMethod(PengendaliPesanan::class, 'checkout');
Database::$mode = 'race';
cek('race idempotensi mengembalikan pesanan yang sudah ada', fn() => $checkout->invoke($controller), 200, 'QA-EXISTING');
Database::$mode = 'quota';
Database::$bacaIdempotensi = 0;
cek('kuota promo habis tetap memberi 409', fn() => $checkout->invoke($controller), 409);

Auth::$admin = false;
cek('tautan berkas berbayar disembunyikan dari tamu',
    fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), 200, null,
    fn($data) => !array_key_exists('fileProduk', $data));
Database::$hargaProduk = 0;
cek('berkas gratis tetap tersedia bagi tamu',
    fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), 200, null,
    fn($data) => $data['fileProduk'] === '/uploads/fixture.zip');
Auth::$admin = true;
Database::$hargaProduk = 100;
cek('admin tetap dapat mengelola berkas berbayar',
    fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), 200, null,
    fn($data) => $data['fileProduk'] === '/uploads/fixture.zip');
foreach (['"bukan-array"', '123', '["/qa.png",null,123,""]'] as $preview) {
    Database::$preview = $preview;
    cek('preview JSON dinormalisasi: ' . $preview,
        fn() => (new PengendaliProduk())->tangani('GET', 'qa', null), 200, null,
        fn($data) => $data['preview'] === (str_starts_with($preview, '[') ? ['/qa.png'] : []));
}
$kirimUlasan = new ReflectionMethod(PengendaliUlasan::class, 'kirim');
foreach ([1, 4, 5] as $rating) {
    $ulasan = new PengendaliUlasan();
    $property->setValue($ulasan, ['produkId' => 'qa', 'pelanggan' => 'QA', 'rating' => $rating]);
    cek("ulasan rating {$rating} menunggu moderasi di DB dan respons", fn() => $kirimUlasan->invoke($ulasan), 201, null,
        fn($data) => $data['status'] === 'Menunggu' && end(Database::$tulisan)['params'][6] === 'Menunggu');
}
Database::$statusProduk = 'Draft';
cek('ulasan produk tidak tersedia ditolak sebelum INSERT', fn() => $kirimUlasan->invoke($ulasan), 422);
$simpanPromo = new ReflectionMethod(PengendaliPromo::class, 'simpan');
foreach ([['2026-02-30', '2026-03-01'], ['2026-12-20', '2026-12-01'], ['abc', '2026-12-01']] as [$mulai, $berakhir]) {
    $promo = new PengendaliPromo();
    $property->setValue($promo, ['kode' => 'QA', 'nama' => 'QA', 'mulai' => $mulai, 'berakhir' => $berakhir]);
    cek("rentang tanggal promo salah ditolak: {$mulai} - {$berakhir}", fn() => $simpanPromo->invoke($promo), 422);
}
exit($gagal > 0 ? 1 : 0);
