<?php
// Contoh konfigurasi: salin ke config.php lalu isi nilai asli.
// PERINGATAN KEAMANAN: file contoh ini ikut ter-commit ke repository, jadi
// JANGAN PERNAH menaruh password asli di sini. Password hanya disimpan di
// config.php (di-gitignore) atau environment GAMEKU_DB_PASS.
//
// LOKAL (bawaan jalan.py / php -S): cukup pakai MySQL/XAMPP localhost.
// HOSTING (InfinityFree): set environment GAMEKU_DB_HOST/NAME/USER/PASS
// di panel server — jangan ubah bawaan localhost di kode.
return [
  'db_host' => '127.0.0.1',
  'db_port' => 3306,
  'db_nama' => 'gameku_store',
  'db_user' => 'root',
  'db_pass' => '', // isi dari panel InfinityFree (Client Area > MySQL), JANGAN commit

  'cors_origins' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],

  'folder_unggah' => dirname(__DIR__) . '/uploads',

  // Asisten AI (proxy server-side — JANGAN taruh key di frontend).
  // Contoh konfigurasi produksi (isi di server, bukan di-commit):
  //   'chat' => [
  //     'endpoint' => getenv('GAMEKU_CHAT_ENDPOINT') ?: '',
  //     'api_key'  => getenv('GAMEKU_CHAT_KEY') ?: '',
  //     'model'    => getenv('GAMEKU_CHAT_MODEL') ?: 'gpt-4o-mini',
  //     'timeout'  => 25,
  //   ],
];

