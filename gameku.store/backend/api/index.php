<?php
// Front controller: semua request /api/* diteruskan ke pengendali.

require_once __DIR__ . '/../src/bootstrap.php';

$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$jalur = rawurldecode($uri);

// Berkas statis diserahkan ke server PHP built-in.
$berkasStatis = realpath(__DIR__ . '/..' . $jalur);
if ($jalur !== '/' && $berkasStatis && is_file($berkasStatis)
    && strpos($berkasStatis, realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR) === 0
    && !preg_match('#/api/#', $jalur)) {
    return false; // server PHP menyajikan berkas aslinya
}

$jalur = preg_replace('#^/api#', '', $jalur) ?? '/';
$jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
$jalur = '/' . trim($jalur, '/');

// Endpoint kesehatan (tanpa database).
if ($jalur === '/' || $jalur === '/sehat' || $jalur === '') {
    $db = Database::ujiKoneksi();
    Bantu::sukses([
        'layanan' => 'gamesku-store',
        'waktu'   => Bantu::sekarang(),
        'database' => $db['ok'] ? 'tersambung' : 'gagal',
    ]);
}


$segmen = array_values(array_filter(explode('/', $jalur), fn($s) => $s !== ''));
$sumber  = $segmen[0] ?? '';
$id      = $segmen[1] ?? null;
$subaksi = $segmen[2] ?? null;
$metode  = Bantu::metode();

// Peta sumber -> kelas pengendali.
$kelasPeta = [
    'auth'      => 'PengendaliAuth',
    'dasbor'    => 'PengendaliDasbor',
    'kategori'  => 'PengendaliKategori',
    'produk'    => 'PengendaliProduk',
    'pesanan'   => 'PengendaliPesanan',
    'pelanggan' => 'PengendaliPelanggan',
    'creator'   => 'PengendaliCreator',
    'promo'     => 'PengendaliPromo',
    'ulasan'    => 'PengendaliUlasan',
    'media'     => 'PengendaliMedia',
    'aktivitas' => 'PengendaliAktivitas',
    'anime'     => 'PengendaliAnime',
];

if (!isset($kelasPeta[$sumber])) {
    Bantu::gagal("Endpoint '{$sumber}' tidak ditemukan.", 404);
}

$namaKelas = $kelasPeta[$sumber];
$pengendali = new $namaKelas();

if (!method_exists($pengendali, 'tangani')) {
    Bantu::gagal("Pengendali '{$sumber}' belum siap.", 501);
}

$pengendali->tangani($metode, $id, $subaksi);
