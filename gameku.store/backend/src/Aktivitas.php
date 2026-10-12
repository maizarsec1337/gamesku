<?php
// =====================================================================
// Aktivitas.php — mencatat jejak aksi ke tabel `aktivitas`.
// Dipakai pengendali lain (produk/kategori/promo/...) untuk audit log.
// Bentuknya meniru layananAktivitas di frontend: teks, ikon, warna.
// =====================================================================

class Aktivitas
{
    // Mencatat satu aktivitas. Kegagalan log tidak boleh membatalkan aksi utama.
    public static function catat(string $teks, string $ikon = 'centangLingkaran', string $warna = 'hijau', ?string $adminPengguna = null): void
    {
        try {
            Database::eksekusi(
                'INSERT INTO aktivitas (teks, ikon, warna, admin_pengguna, dibuat_pada) VALUES (?, ?, ?, ?, NOW())',
                [Bantu::potong($teks, 255), $ikon, $warna, $adminPengguna]
            );
        } catch (Throwable $e) {
            // Diamkan: pencatatan aktivitas bersifat sampingan.
        }
    }

    // Daftar aktivitas terbaru (paling baru dulu), dibatasi jumlah.
    public static function terbaru(int $jumlah = 50): array
    {
        $jumlah = max(1, min(200, $jumlah));
        return Database::banyak(
            'SELECT id, teks, ikon, warna, admin_pengguna AS pengguna, dibuat_pada AS waktu
             FROM aktivitas ORDER BY id DESC LIMIT ' . $jumlah
        );
    }

    // Mengosongkan seluruh jejak aktivitas.
    public static function kosongkan(): void
    {
        Database::eksekusi('DELETE FROM aktivitas');
    }
}
