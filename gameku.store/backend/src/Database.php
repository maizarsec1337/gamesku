<?php
// =====================================================================
// Database.php — koneksi PDO MySQL + helper query ringkas.
// Satu koneksi dipakai ulang (singleton) untuk seluruh request.
// =====================================================================

class Database
{
    private static ?PDO $pdo = null;

    // Mengambil koneksi PDO (dibuat sekali lalu dipakai ulang).
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
            ]);
        } catch (PDOException $e) {
            // Jangan bocorkan detail koneksi ke klien.
            Bantu::gagal('Koneksi database gagal. Periksa konfigurasi server.', 500);
        }

        return self::$pdo;
    }

    // Menjalankan prepared statement dan mengembalikan statement-nya.
    public static function jalankan(string $sql, array $param = []): PDOStatement
    {
        $stmt = self::koneksi()->prepare($sql);
        $stmt->execute($param);
        return $stmt;
    }

    // Satu baris (atau null bila tidak ada).
    public static function satu(string $sql, array $param = []): ?array
    {
        $hasil = self::jalankan($sql, $param)->fetch();
        return $hasil === false ? null : $hasil;
    }

    // Banyak baris (array asosiatif).
    public static function banyak(string $sql, array $param = []): array
    {
        return self::jalankan($sql, $param)->fetchAll();
    }

    // INSERT/UPDATE/DELETE — mengembalikan jumlah baris terpengaruh.
    public static function eksekusi(string $sql, array $param = []): int
    {
        return self::jalankan($sql, $param)->rowCount();
    }

    // Mengambil satu kolom dari baris pertama (skalar) atau null.
    public static function nilai(string $sql, array $param = [])
    {
        $hasil = self::jalankan($sql, $param)->fetch();
        return $hasil === false ? null : reset($hasil);
    }

    // ID terakhir yang di-insert (untuk kolom auto-increment).
    public static function idTerakhir()
    {
        return self::koneksi()->lastInsertId();
    }

    // Membungkus operasi dalam transaksi. Callback melempar exception untuk rollback.
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

    // Uji koneksi (dipakai endpoint sehat / instalasi).
    // TIDAK memakai koneksi() agar tidak ikut exit bila DB mati.
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
