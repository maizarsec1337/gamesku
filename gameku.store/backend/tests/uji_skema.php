<?php
// Uji statis skema & rute: memastikan berkas skema/migrasi/rute saling konsisten.
// Tidak menyentuh database.

grup('Skema & Rute');

function isiBerkas(string $relatif): string
{
    $path = __DIR__ . '/../' . $relatif;
    return is_file($path) ? (string) file_get_contents($path) : '';
}

uji('schema.sql memuat semua tabel yang dirujuk aplikasi', function () {
    $skema = isiBerkas('database/schema.sql');
    $wajib = [
        'admin', 'pelanggan', 'creator', 'kategori', 'produk', 'promo', 'media',
        'produk_media', 'pesanan', 'pesanan_item', 'ulasan', 'pembayaran',
        'pembayaran_event', 'percakapan', 'anggota_percakapan', 'pesan',
        'pesan_lampiran', 'pesan_baca', 'riwayat_tontonan', 'audit_log', 'aktivitas',
    ];
    $ada = [];
    if (preg_match_all('/CREATE TABLE IF NOT EXISTS `([a-z_]+)`/i', $skema, $m)) {
        $ada = $m[1];
    }
    $hilang = array_values(array_diff($wajib, $ada));
    tegaskan($hilang === [], 'tabel hilang di schema.sql: ' . implode(', ', $hilang));
});

uji('schema.sql memuat index yang diandalkan query', function () {
    $skema = isiBerkas('database/schema.sql');
    $index = [
        'uniq_pesanan_idempotency', 'idx_pesanan_email', 'idx_pesanan_status_dibuat',
        'idx_produk_jenis_status', 'idx_produk_kategori_status',
        'idx_pelanggan_username', 'idx_pelanggan_status_bergabung',
        'idx_pesan_percakapan_kirim', 'uniq_anggota',
        'uniq_pembayaran_pesanan', 'uniq_pembayaran_idem',
    ];
    foreach ($index as $nama) {
        tegaskan(strpos($skema, "`{$nama}`") !== false, "index hilang: {$nama}");
    }
});

uji('migrasi.php adalah runner berversi & mencakup modul tambahan', function () {
    $mig = isiBerkas('database/migrasi.php');
    tegaskan($mig !== '', 'migrasi.php tidak ditemukan');
    tegaskan(strpos($mig, 'schema_migrations') !== false, 'tabel schema_migrations tidak ada');
    foreach (['idempotency_key', 'audit_log', 'produk_media', 'percakapan', 'pembayaran', 'riwayat_tontonan'] as $penanda) {
        tegaskan(strpos($mig, $penanda) !== false, "migrasi tidak mencakup: {$penanda}");
    }
    tegaskan(strpos($mig, '$migrasi[]') !== false, 'definisi daftar migrasi tidak ada');
});

uji('setiap sumber di router punya berkas pengendali', function () {
    $router = isiBerkas('api/index.php');
    preg_match_all("/'([a-z]+)'\\s*=>\\s*'(Pengendali[A-Za-z]+)'/", $router, $m, PREG_SET_ORDER);
    tegaskan(count($m) > 0, 'peta kelas router tidak terbaca');
    foreach ($m as $pasangan) {
        $kelas = $pasangan[2];
        $berkas = __DIR__ . "/../src/Pengendali/{$kelas}.php";
        tegaskan(is_file($berkas), "pengendali '{$kelas}' (sumber '{$pasangan[1]}') tidak punya berkas");
    }
    // Modul baru harus terdaftar.
    tegaskan(strpos($router, "'pembayaran'") !== false, "rute 'pembayaran' tidak terdaftar");
    tegaskan(strpos($router, "'pesan'") !== false, "rute 'pesan' tidak terdaftar");
});

uji('kelas yang dipakai pengendali tersedia di src', function () {
    $wajib = ['Auth', 'Bantu', 'Database', 'RateLimiter', 'SecurityLog', 'Aktivitas', 'Kecil'];
    foreach ($wajib as $kelas) {
        tegaskan(is_file(__DIR__ . "/../src/{$kelas}.php"), "src/{$kelas}.php hilang");
    }
});

uji('router mendaftarkan sumber reseller ke PengendaliReseller', function () {
    $router = isiBerkas('api/index.php');
    tegaskan(strpos($router, "'reseller'  => 'PengendaliReseller'") !== false
        || strpos($router, "'reseller' => 'PengendaliReseller'") !== false,
        "sumber 'reseller' tidak terdaftar ke PengendaliReseller");
    tegaskan(is_file(__DIR__ . '/../src/Pengendali/PengendaliReseller.php'),
        'PengendaliReseller.php tidak ditemukan');
});

uji('schema.sql + migrasi mencakup tabel & constraint reseller', function () {
    $skema = isiBerkas('database/schema.sql');
    $mig = isiBerkas('database/migrasi.php');
    tegaskan(strpos($skema, 'CREATE TABLE IF NOT EXISTS `reseller_pengajuan`') !== false,
        'tabel reseller_pengajuan tidak ada di schema.sql');
    // Constraint unik aktif (cek duplikat pending/approved), FK pelanggan + admin.
    tegaskan(strpos($skema, '`aktif` TINYINT AS (IF(status IN') !== false,
        'kolom generated `aktif` tidak ada di schema.sql');
    tegaskan(strpos($skema, '`uniq_reseller_pelanggan_aktif`') !== false,
        'unique constraint reseller aktif tidak ada di schema.sql');
    tegaskan(strpos($skema, 'CONSTRAINT `fk_reseller_pelanggan`') !== false,
        'FK reseller_pelanggan tidak ada di schema.sql');
    tegaskan(strpos($skema, "REFERENCES `admin` (`id`)") !== false || strpos($skema, 'fk_reseller_admin') !== false,
        'FK reseller_admin tidak ada di schema.sql');
    tegaskan(strpos($mig, '$migrasi[]') !== false && strpos($mig, 'reseller_pengajuan') !== false,
        'migrasi tidak mencakup reseller_pengajuan');
});

uji('controller reseller memiliki metode aksi & identitas pembeli dari sesi', function () {
    $src = (string) file_get_contents(__DIR__ . '/../src/Pengendali/PengendaliReseller.php');
    foreach (['tangani', 'saya', 'buat', 'batal', 'daftar', 'satu', 'ubahStatus'] as $metode) {
        tegaskan(strpos($src, "function {$metode}") !== false, "method {$metode} hilang");
    }
    // Identitas harus dari sesi, bukan dari request body.
    tegaskan(strpos($src, 'Auth::sesiPembeli()') !== false,
        'controller harus ambil identitas dari sesi pembeli');
    tegaskan(stripos($src, 'teks(\'user_id\'') === false && stripos($src, 'teks("user_id"') === false,
        'controller tidak boleh membaca user_id dari request');
});
