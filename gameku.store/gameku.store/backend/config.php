<?php
/**
 * ===========================================================================
 * PRODUCTION CONFIGURATION — gamesku.store (backend PHP)
 * ===========================================================================
 * SALIN dari `config/contoh.config.php` lalu isi nilai sesungguhnya.
 *
 * JANGAN meng-commit file ini ke repository.
 * JANGAN pernah menyimpan password MySQL tanpa enkripsi di disk (gunakan
 * file sistem dengan izin terbatas 0600).
 * ===========================================================================
 */

// --- Load konfigurasi contoh tak langsung agar server tidak mengekspos ---
$contoh = __DIR__ . '/contoh.config.php';
if (is_file($contoh)) {
    $cfg = require $contoh;

    // GANTI nilai sesungguhnya — contoh AMAN, jangan gunakan 'root'.
    $cfg['db_host']   = '127.0.0.1';
    $cfg['db_port']   = 3306;
    $cfg['db_nama']   = 'gamesku_store';
    $cfg['db_user']   = '';    // ← GANTI: akun minimal-privilege dari database
    $cfg['db_pass']   = '';    // ← GANTI: password dari database

    // Jika terpaksa butuh akun admin untuk instalasi, definisikan di sini:
    // $cfg['db_admin_user'] = 'root';
    // $cfg['db_admin_pass'] = '';

    $cfg['cors_origins'] = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        // 'https://yourdomain.com',
    ];

    $cfg['secure_cookies'] = (bool) getenv('GAMEKU_SECURE_COOKIE');

    return $cfg;
}

// --- Fallback: gagal muat config ---
throw new RuntimeException(
    'Konfigurasi tidak ditemukan. Salin config/contoh.config.php ke config/config.php.' .
    ' Lihat README.md untuk petunjuk pembuatan database user minimal-privilege.'
);

