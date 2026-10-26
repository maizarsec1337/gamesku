<?php
// Koneksi PDO MySQL (singleton) + helper query ringkas.

class Database
{
    private static ?PDO $pdo = null;

    public static function driver(): string
    {
        $cfg = require __DIR__ . '/../config/config.php';
        $driver = strtolower((string) ($cfg['db_driver'] ?? 'mysql'));
        if (in_array($driver, ['postgres', 'postgresql'], true)) {
            $driver = 'pgsql';
        }
        return $driver === 'pgsql' ? 'pgsql' : 'mysql';
    }

    private static function buatDsn(array $cfg, string $driver): string
    {
        $host = $cfg['db_host'] ?? '127.0.0.1';
        $port = $cfg['db_port'] ?? ($driver === 'pgsql' ? 5432 : 3306);
        $nama = $cfg['db_nama'] ?? ($driver === 'pgsql' ? 'postgres' : 'gameku_store');

        if ($driver === 'pgsql') {
            $dsn = "pgsql:host={$host};port={$port};dbname={$nama}";
            $sslmode = $cfg['db_sslmode'] ?? '';
            if ($sslmode !== '') {
                $dsn .= ';sslmode=' . $sslmode;
            }
            return $dsn;
        }

        return "mysql:host={$host};port={$port};dbname={$nama};charset=utf8mb4";
    }

    public static function koneksi(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = require __DIR__ . '/../config/config.php';
        $driver = self::driver();
        $user = $cfg['db_user'] ?? ($driver === 'pgsql' ? 'postgres' : 'root');
        $pass = $cfg['db_pass'] ?? '';
        $dsn = self::buatDsn($cfg, $driver);

        try {
            $opsi = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 8,
            ];
            if ($driver === 'mysql') {
                $opsi[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4";
            }
            self::$pdo = new PDO($dsn, $user, $pass, $opsi);
        } catch (PDOException $e) {
            error_log('[gameku] Koneksi database gagal: ' . $e->getMessage());
            Bantu::gagal('Koneksi database gagal. Periksa konfigurasi server.', 500);
        }

        return self::$pdo;
    }

    private static function normalisasiSqlPostgres(string $sql): string
    {
        $sql = str_replace('`', '"', $sql);

        if (stripos($sql, 'INSERT IGNORE INTO') !== false) {
            $sql = preg_replace('/INSERT\s+IGNORE\s+INTO/i', 'INSERT INTO', $sql);
            if (stripos($sql, 'ON CONFLICT') === false) {
                $sql = rtrim($sql);
                if (substr($sql, -1) === ';') {
                    $sql = substr($sql, 0, -1);
                }
                $sql .= ' ON CONFLICT DO NOTHING';
            }
        }

        return $sql;
    }

    private static function siapkanSql(string $sql): string
    {
        if (self::driver() === 'pgsql') {
            return self::normalisasiSqlPostgres($sql);
        }
        return $sql;
    }

    public static function jalankan(string $sql, array $param = []): PDOStatement
    {
        $stmt = self::koneksi()->prepare(self::siapkanSql($sql));
        $stmt->execute($param);
        return $stmt;
    }

    public static function satu(string $sql, array $param = []): ?array
    {
        $hasil = self::jalankan($sql, $param)->fetch();
        return $hasil === false ? null : $hasil;
    }

    public static function banyak(string $sql, array $param = []): array
    {
        return self::jalankan($sql, $param)->fetchAll();
    }

    // INSERT/UPDATE/DELETE: jumlah baris terpengaruh.
    public static function eksekusi(string $sql, array $param = []): int
    {
        return self::jalankan($sql, $param)->rowCount();
    }

    public static function nilai(string $sql, array $param = [])
    {
        $hasil = self::jalankan($sql, $param)->fetch();
        return $hasil === false ? null : reset($hasil);
    }

    public static function idTerakhir()
    {
        $pdo = self::koneksi();
        if (self::driver() === 'pgsql') {
            try {
                return $pdo->query('SELECT LASTVAL()')->fetchColumn();
            } catch (Throwable $e) {
                return $pdo->lastInsertId();
            }
        }
        return $pdo->lastInsertId();
    }

    // Callback melempar exception untuk rollback.
    public static function transaksi(callable $kerja)
    {
        $pdo = self::koneksi();
        $pdo->beginTransaction();
        try {
            $hasil = $kerja($pdo);
            $pdo->commit();
            return $hasil;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    // Uji koneksi tanpa memakai koneksi() agar tidak exit bila DB mati.
    public static function ujiKoneksi(): array
    {
        try {
            $cfg = require __DIR__ . '/../config/config.php';
            $driver = strtolower((string) ($cfg['db_driver'] ?? 'mysql'));
            if (in_array($driver, ['postgres', 'postgresql'], true)) {
                $driver = 'pgsql';
            }
            $host = $cfg['db_host'] ?? '127.0.0.1';
            $port = $cfg['db_port'] ?? ($driver === 'pgsql' ? 5432 : 3306);
            $nama = $cfg['db_nama'] ?? ($driver === 'pgsql' ? 'postgres' : 'gameku_store');
            $user = $cfg['db_user'] ?? ($driver === 'pgsql' ? 'postgres' : 'root');
            $pass = $cfg['db_pass'] ?? '';

            if ($driver === 'pgsql') {
                $dsn = "pgsql:host={$host};port={$port};dbname={$nama}";
                if (!empty($cfg['db_sslmode'])) {
                    $dsn .= ';sslmode=' . $cfg['db_sslmode'];
                }
            } else {
                $dsn = "mysql:host={$host};port={$port};dbname={$nama};charset=utf8mb4";
            }

            $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 3]);
            $pdo->query('SELECT 1');
            return ['ok' => true];
        } catch (Throwable $e) {
            return ['ok' => false, 'pesan' => 'Database tidak dapat dihubungi.'];
        }
    }
}
