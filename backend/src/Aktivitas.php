<?php
// Pencatat jejak audit ke tabel `aktivitas` + `audit_log` (jejak detail aksi admin).

class Aktivitas
{
    public static function catat(string $teks, string $ikon = 'centangLingkaran', string $warna = 'hijau', ?string $adminPengguna = null): void
    {
        try {
            Database::eksekusi(
                'INSERT INTO aktivitas (teks, ikon, warna, admin_pengguna, dibuat_pada) VALUES (?, ?, ?, ?, NOW())',
                [Bantu::potong($teks, 255), $ikon, $warna, $adminPengguna]
            );
        } catch (Throwable $e) {
            // Pencatatan aktivitas bersifat sampingan; kegagalan diabaikan.
        }
    }

    /**
     * Audit trail terstruktur untuk aksi admin & perubahan data penting
     * (tabel audit_log: IP, hasil, target, request ID).
     *
     * @param string $jenis    Jenis aksi: 'ubah_status_pesanan','hapus_produk',dst.
     * @param string $targetTabel Tabel yang disentuh.
     * @param string $targetId ID baris yang disentuh.
     * @param string $hasil    'Berhasil' | 'Gagal' | 'Ditolak'.
     * @param array  $detail   Data tambahan (disanitasi; tanpa rahasia).
     */
    public static function audit(
        string $jenis,
        string $targetTabel = '',
        string $targetId = '',
        string $hasil = 'Berhasil',
        array $detail = [],
        string $teks = '',
        bool $throw = false
    ): bool {
        try {
            $sesi = $_SESSION['admin'] ?? null;
            $ip = RateLimiter::ip();
            Database::eksekusi(
                'INSERT INTO audit_log (user_tipe, user_id, jenis_aktivitas, hasil, target_table, target_id,
                     teks, detail_json, alamat_ip, dibuat_pada)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    $sesi ? 'admin' : 'publik',
                    $sesi ? (string) $sesi['id'] : null,
                    Bantu::potong($jenis, 60),
                    Bantu::potong($hasil, 20),
                    Bantu::potong($targetTabel, 60),
                    Bantu::potong($targetId, 100),
                    Bantu::potong($teks !== '' ? $teks : $jenis, 255),
                    $detail !== [] ? self::detailAman($detail) : null,
                    $ip,
                ]
            );
        } catch (Throwable $e) {
            // Audit bersifat sampingan; secara default jangan rusakkan request utama.
            if ($throw) {
                throw new RuntimeException(
                    'Pencatatan audit gagal: ' . $e->getMessage(),
                    (int) $e->getCode(),
                    $e
                );
            }
            return false;
        }
    }

    // Susun detail JSON tanpa kunci sensitif.
    private static function detailAman(array $detail): ?string
    {
        $larang = ['password', 'sandi', 'token', 'csrf', 'cookie', 'secret', 'authorization'];
        $bersih = [];
        foreach ($detail as $k => $v) {
            $rendah = strtolower((string) $k);
            $terlarang = false;
            foreach ($larang as $l) {
                if (strpos($rendah, $l) !== false) {
                    $terlarang = true;
                    break;
                }
            }
            if ($terlarang) {
                continue;
            }
            $bersih[$k] = is_scalar($v) || $v === null ? $v : json_encode($v);
        }
        $json = json_encode($bersih, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $json === false ? null : Bantu::potong($json, 4000);
    }

    public static function terbaru(int $jumlah = 50): array
    {
        $jumlah = max(1, min(200, $jumlah));
        return Database::banyak(
            'SELECT id, teks, ikon, warna, admin_pengguna AS pengguna, dibuat_pada AS waktu
             FROM aktivitas ORDER BY id DESC LIMIT ' . $jumlah
        );
    }

    public static function kosongkan(): void
    {
        Database::eksekusi('DELETE FROM aktivitas');
    }
}
