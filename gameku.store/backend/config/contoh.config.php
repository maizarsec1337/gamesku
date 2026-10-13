<?php
// Konfigurasi backend gamesku.store.
// Salin ke config.php lalu isi nilai asli (jangan commit kredensial).
return [
  'db_host' => 'sql302.infinityfree.com',
  'db_port' => 3306,
  'db_nama' => 'if0_41354263_gameku_db',
  'db_user' => 'if0_41354263',
  'db_pass' => '9qoXWF4CI8XyB',

  // Origin frontend yang diizinkan memanggil backend langsung (untuk CORS).
  'cors_origins' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],

  // Folder penyimpanan unggahan.
  'folder_unggah' => dirname(__DIR__) . '/uploads',
];

