<?php
// Front controller: semua request /api/* diteruskan ke pengendali.

require_once __DIR__ . '/../src/bootstrap.php';

$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$jalur = rawurldecode($uri);

// Larang akses web ke direktori internal (berisi kredensial/ error).
// Server PHP built-in mengabaikan .htaccess, jadi perlindungan harus ada di sini
// DITEMPATKAN SEBELUM penyajian berkas statis agar tidak terlewati.
if (preg_match('#^/(config|logs|src|database|tests)(/|$)#i', $jalur)
    || preg_match('#(^|/)[.]#', $jalur)) {
    Bantu::gagal('Tidak ditemukan.', 404);
}

// Berkas statis diserahkan ke server PHP built-in.
$berkasStatis = realpath(__DIR__ . '/..' . $jalur);
$akarPublik = realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR;
$relatif = $berkasStatis ? str_replace('\\', '/', substr($berkasStatis, strlen($akarPublik))) : '';
// Built-in server mengabaikan .htaccess: hanya aset publik yang boleh
// dilayani langsung, termasuk pemeriksaan path hasil realpath (symlink).
$asetPublik = preg_match('#^(uploads|assets|image)/#', $relatif)
    && preg_match('#\.(png|jpe?g|webp|gif|svg|ico|zip|pdf|css|js|woff2?|ttf)$#i', $relatif);
if ($jalur !== '/' && $berkasStatis && is_file($berkasStatis)
    && strpos($berkasStatis, $akarPublik) === 0 && $asetPublik) {
    return false; // server PHP menyajikan berkas aslinya
}

$jalur = preg_replace('#^/api#', '', $jalur) ?? '/';
$jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
$jalur = '/' . trim($jalur, '/');

// Larang akses web ke log internal (server PHP built-in mengabaikan .htaccess).
if ($jalur === '/logs' || strpos($jalur, '/logs/') === 0) {
    Bantu::gagal('Tidak ditemukan.', 404);
}

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
    'reseller'  => 'PengendaliReseller',
    'pembayaran'=> 'PengendaliPembayaran',
    'pesan'     => 'PengendaliPesan',
    'anime'     => 'PengendaliAnime',
    'chat'      => 'PengendaliChat',
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
