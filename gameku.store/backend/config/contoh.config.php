<?php
// Konfigurasi backend gameku.store.
// Salin ke config.php lalu isi nilai asli (jangan commit kredensial).
return [
  'db_host' => '127.0.0.1',
  'db_port' => 3306,
  'db_nama' => 'gameku_store',
  'db_user' => 'root',
  'db_pass' => '',

  // Origin frontend yang diizinkan memanggil backend langsung (untuk CORS).
  'cors_origins' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],

  // Folder penyimpanan unggahan.
  'folder_unggah' => dirname(__DIR__) . '/uploads',
];

