<?php
// Koneksi PDO MySQL (singleton) + helper query ringkas.

class Database
{
    private static ?PDO $pdo = null;

    public static function koneksi(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = require __DIR__ . '/../config/config.php';

        $host = $cfg['db_host'] ?? '127.0.0.1';
        $port = $cfg['db_port'] ?? 3306;
        $nama = $cfg['db_nama'] ?? 'gameku_store';
        $user = $cfg['db_user'] ?? 'root';
        $pass = $cfg['db_pass'] ?? '';
        $dsn  = "mysql:host={$host};port={$port};dbname={$nama};charset=utf8mb4";

        try {
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                // MYSQL_OPT_CONNECT_TIMEOUT: jangan hang lama bila host DB
                // tidak terjangkau (mis. diblokir jaringan/kebijakan hosting).
                PDO::ATTR_TIMEOUT            => 8,
            ]);
        } catch (PDOException $e) {
            // Detail asli HANYA ke log server (pesan PDO tidak memuat password);
            // ke klien cukup pesan generik tanpa detail koneksi.
            error_log('[gameku] Koneksi database gagal: ' . $e->getMessage());
            Bantu::gagal('Koneksi database gagal. Periksa konfigurasi server.', 500);
        }

        return self::$pdo;
    }

    public static function jalankan(string $sql, array $param = []): PDOStatement
    {
        $stmt = self::koneksi()->prepare($sql);
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
        return self::koneksi()->lastInsertId();
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
            $host = $cfg['db_host'] ?? '127.0.0.1';
            $port = $cfg['db_port'] ?? 3306;
            $nama = $cfg['db_nama'] ?? 'gameku_store';
            $dsn  = "mysql:host={$host};port={$port};dbname={$nama};charset=utf8mb4";
            $pdo = new PDO($dsn, $cfg['db_user'] ?? 'root', $cfg['db_pass'] ?? '', [
                PDO::ATTR_TIMEOUT => 3,
            ]);
            $pdo->query('SELECT 1');
            return ['ok' => true];
        } catch (Throwable $e) {
            return ['ok' => false, 'pesan' => 'Database tidak dapat dihubungi.'];
        }
    }
}
