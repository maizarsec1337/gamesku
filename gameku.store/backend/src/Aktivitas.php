<?php
// Pencatat jejak audit ke tabel `aktivitas`.

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
