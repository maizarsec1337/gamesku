<?php
// Konfigurasi backend. Mendukung MySQL (lokal) dan PostgreSQL (Supabase).
// Prioritas sumber konfigurasi DB:
//   1. DATABASE_URL / GAMEKU_DATABASE_URL / SUPABASE_DB_URL (format URL koneksi)
//   2. Variabel lingkungan GAMEKU_DB_* (individual)
//   3. Nilai default (MySQL lokal).

$databaseUrl = getenv('DATABASE_URL')
    ?: getenv('GAMEKU_DATABASE_URL')
    ?: getenv('SUPABASE_DB_URL');

$parsed = null;
if (is_string($databaseUrl) && $databaseUrl !== '') {
    $parts = parse_url($databaseUrl);
    if (is_array($parts) && !empty($parts['host'])) {
        $scheme = strtolower((string) ($parts['scheme'] ?? 'pgsql'));
        $driver = in_array($scheme, ['postgres', 'postgresql'], true) ? 'pgsql' : $scheme;
        $parsed = [
            'db_driver' => $driver,
            'db_host'   => $parts['host'],
            'db_port'   => isset($parts['port']) ? (int) $parts['port'] : ($driver === 'pgsql' ? 5432 : 3306),
            'db_nama'   => isset($parts['path']) ? ltrim((string) $parts['path'], '/') : ($driver === 'pgsql' ? 'postgres' : 'gameku_store'),
            'db_user'   => isset($parts['user']) ? urldecode((string) $parts['user']) : '',
            'db_pass'   => isset($parts['pass']) ? urldecode((string) $parts['pass']) : '',
        ];
    }
}

$driverDefault = $parsed['db_driver'] ?? 'mysql';

return [
    'db_driver'  => getenv('GAMEKU_DB_DRIVER') ?: $driverDefault,
    'db_host'    => getenv('GAMEKU_DB_HOST') ?: ($parsed['db_host'] ?? '127.0.0.1'),
    'db_port'    => (int) (getenv('GAMEKU_DB_PORT') ?: ($parsed['db_port'] ?? 3306)),
    'db_nama'    => getenv('GAMEKU_DB_NAME') ?: ($parsed['db_nama'] ?? 'gameku_store'),
    'db_user'    => getenv('GAMEKU_DB_USER') ?: ($parsed['db_user'] ?? 'root'),
    'db_pass'    => getenv('GAMEKU_DB_PASS') !== false ? getenv('GAMEKU_DB_PASS') : ($parsed['db_pass'] ?? ''),
    'db_sslmode' => getenv('GAMEKU_DB_SSLMODE') ?: 'require',
    'cors_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
    'folder_unggah' => dirname(__DIR__) . '/uploads',
    'request' => ['max_json_size' => 262144, 'max_upload_size' => 536870912],
];
