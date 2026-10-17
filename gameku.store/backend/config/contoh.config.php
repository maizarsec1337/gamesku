<?php
// Contoh konfigurasi: salin ke config.php lalu isi nilai asli.
// PERINGATAN KEAMANAN: file contoh ini ikut ter-commit ke repository, jadi
// JANGAN PERNAH menaruh password asli di sini. Password hanya disimpan di
// config.php (di-gitignore) atau environment GAMEKU_DB_PASS.
return [
  'db_host' => 'sql302.infinityfree.com',
  'db_port' => 3306,
  'db_nama' => 'if0_41354263_gameku_db',
  'db_user' => 'if0_41354263',
  'db_pass' => '', // isi dari panel InfinityFree (Client Area > MySQL), JANGAN commit

  'cors_origins' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],

  'folder_unggah' => dirname(__DIR__) . '/uploads',
];

