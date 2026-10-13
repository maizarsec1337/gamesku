<?php
// =====================================================================
// api/index.php — FRONT CONTROLLER / ROUTER backend gamesku.
//
// Semua request /api/* masuk ke sini lalu diteruskan ke pengendali.
// Bentuk respons seragam: { ok, data?, pesan }.
//
// Menjalankan server (dari folder backend):
//   php -S localhost:8000 -t . api/index.php
// Router dipakai agar path bersih (/api/produk, /api/produk/{id}) bekerja.
// Berkas statis (mis. /uploads/gambar.png) tetap dilayani server.
// =====================================================================

require_once __DIR__ . '/../src/bootstrap.php';

// --- Tentukan path relatif (tanpa query string) ---
$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$jalur = rawurldecode($uri);

// --- Berkas statis: biarkan server PHP built-in menyajikannya ---
$berkasStatis = realpath(__DIR__ . '/..' . $jalur);
if ($jalur !== '/' && $berkasStatis && is_file($berkasStatis)
    && strpos($berkasStatis, realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR) === 0
    && !preg_match('#/api/#', $jalur)) {
    return false; // server PHP menyajikan berkas aslinya
}

// --- Normalisasi: buang awalan /api dan akhiran .php ---
$jalur = preg_replace('#^/api#', '', $jalur) ?? '/';
$jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
$jalur = '/' . trim($jalur, '/');

// --- Endpoint kesehatan (tanpa database) ---
if ($jalur === '/' || $jalur === '/sehat' || $jalur === '') {
    $db = Database::ujiKoneksi();
    Bantu::sukses([
        'layanan' => 'gamesku-store',
        'waktu'   => Bantu::sekarang(),
        'database' => $db['ok'] ? 'tersambung' : 'gagal',
    ]);
}


// --- Pecah path menjadi segmen ---
$segmen = array_values(array_filter(explode('/', $jalur), fn($s) => $s !== ''));
$sumber  = $segmen[0] ?? '';
$id      = $segmen[1] ?? null;
$subaksi = $segmen[2] ?? null;
$metode  = Bantu::metode();

// --- Peta sumber -> kelas pengendali ---
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
];

if (!isset($kelasPeta[$sumber])) {
    Bantu::gagal("Endpoint '{$sumber}' tidak ditemukan.", 404);
}

$namaKelas = $kelasPeta[$sumber];
$pengendali = new $namaKelas();

if (!method_exists($pengendali, 'tangani')) {
    Bantu::gagal("Pengendali '{$sumber}' belum siap.", 501);
}

// --- Teruskan ke pengendali dengan metode, id, dan subaksi ---
$pengendali->tangani($metode, $id, $subaksi);
