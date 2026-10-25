<?php
return [
    'db_host' => getenv('GAMEKU_DB_HOST') ?: '127.0.0.1',
    'db_port' => (int) (getenv('GAMEKU_DB_PORT') ?: 3306),
    'db_nama' => getenv('GAMEKU_DB_NAME') ?: 'gameku_store',
    'db_user' => getenv('GAMEKU_DB_USER') ?: 'root',
    'db_pass' => getenv('GAMEKU_DB_PASS') ?: '',
    'cors_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
    'folder_unggah' => dirname(__DIR__) . '/uploads',
    'request' => ['max_json_size' => 262144, 'max_upload_size' => 8388608],
];
