<?php
/**
 * ===========================================================================
 * CONTOH CONFIGURATION — gamesku.store (backend PHP)
 * ===========================================================================
 * Salin ke `config/config.php` lalu isi nilai sesungguhnya.
 * JANGAN pernah meng-commit `config.php` ke repository.
 * ===========================================================================
 */

return [
    // --- Kredensial database: akun MEMANGGIL APLIKASI (minimal privilege) ---
    // Ganti 'apps_backend' dengan nama user yang dibuat via:
    //   CREATE USER 'apps_backend'@'127.0.0.1' IDENTIFIED BY 'RANDOM_PASSWORD';
    //   GRANT SELECT, INSERT, UPDATE ON gamesku_store.* TO 'apps_backend'@'127.0.0.1';
    //   FLUSH PRIVILEGES;
    'db_host'  => '127.0.0.1',
    'db_port'  => 3306,
    'db_nama'  => 'gamesku_store',

    // User API (baca + tulis untuk CRUD biasa)
    'db_user' => 'apps_backend',

    // Password: berikan yang minimum. Ganti `rand(OFFSET, LEN)` di sini.  <-- sengaja sengaja placeholder
    'db_pass' => '',

    // --- Read-only akun (opsional: untuk API read-only / reports) ---
    // 'db_user_read' => 'apps_read',
    // 'db_pass_read' => '',

    // --- Alternatif: master untuk instalasi & pemeliharaan ---
    // Gunakan hanya di `database/instal.php` dan migration script.
    // 'db_admin_user' => 'root',
    // 'db_admin_pass' => '',

    // --- CORS (origin frontend yang diizinkan) ---
    'cors_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://yourdomain.com',
    ],

    // --- Session / Security ---
    'session_name'        => 'gamesku_admin',
    'session_lifetime'    => 1800,            // 30 menit
    'session_regenerate'  => true,            // selalu regenerate ID sesi
    'csrf_sessions'       => true,            // token CSRF disimpan di session
    'csrf_length'         => 32,              // bytes (hex output = 64 chars)
    'secure_cookies'      => (bool) getenv('GAMEKU_SECURE_COOKIE'),

    // --- Rate limiting (per IP, sliding window) ---
    'rate_limit_authentication_max'  => 10,   // login: 10 per 60 detik
    'rate_limit_authentication_win'  => 60,
    'rate_limit_write_max'           => 60,   // POST/PUT/PATCH/DELETE: 60 per 60 detik
    'rate_limit_write_win'           => 60,
    'rate_limit_generic_read_max'    => 120,  // GET: 120 per 60 detik
    'rate_limit_generic_read_win'    => 60,

    // --- Enforce URLs (anti-open-redirect & path traversal) ---
    'enforce_sri' => [
        'enabled' => true,
        'allowed' => [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ],
    ],

    // --- Logging & Error Handling ---
    'log_dir'           => dirname(__DIR__) . '/logs',
    'log_level'         => 'info',          // debug | info | warning | error
    'display_errors'    => false,             // always false di production
    'log_errors'        => true,
    'error_reporting'   => E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED,

    // --- Backup (jika digunakan di deployment) ---
    'backup' => [
        'enabled' => false,
        'dir'     => dirname(__DIR__) . '/backups',
        'cron'    => '0 2 * * *',             // setiap malam pukul 02:00
        'retention' => 30,                     // hari
    ],
];
