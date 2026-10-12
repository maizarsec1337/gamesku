<?php
// =====================================================================
// Auth.php — autentikasi admin berbasis sesi PHP.
// Password disimpan sebagai hash (password_hash / password_verify).
// Kredensial diperiksa di server, bukan di peramban.
// =====================================================================

class Auth
{
    // Memulai sesi secara aman (hanya sekali).
    public static function mulai(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            // Cookie sesi hanya lewat HTTP dan tidak terakses JS.
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'path'     => '/',
            ]);
            session_start();
        }
    }

    // Mencoba masuk. Mengembalikan data admin (tanpa hash) bila berhasil.
    public static function masuk(string $pengguna, string $sandi): array
    {
        $baris = Database::satu(
            'SELECT id, pengguna, nama, sandi_hash, status FROM admin WHERE pengguna = ? LIMIT 1',
            [$pengguna]
        );

        // Pesan gagal dibuat samar agar tidak membocorkan akun yang ada.
        if (!$baris || !password_verify($sandi, $baris['sandi_hash'])) {
            return ['berhasil' => false, 'pesan' => 'Pengguna atau sandi salah.'];
        }
        if (($baris['status'] ?? 'Aktif') !== 'Aktif') {
            return ['berhasil' => false, 'pesan' => 'Akun admin tidak aktif.'];
        }

        // Cegah session fixation.
        session_regenerate_id(true);
        $_SESSION['admin'] = [
            'id'      => (int) $baris['id'],
            'pengguna'=> $baris['pengguna'],
            'nama'    => $baris['nama'],
        ];

        return [
            'berhasil' => true,
            'data'     => ['id' => (int) $baris['id'], 'pengguna' => $baris['pengguna'], 'nama' => $baris['nama']],
        ];
    }

    // Keluar dari sesi.
    public static function keluar(): void
    {
        self::mulai();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool) ($p['secure'] ?? false), true);
        }
        session_destroy();
    }

    // Data sesi admin yang sedang masuk (atau null).
    public static function sesi(): ?array
    {
        self::mulai();
        return $_SESSION['admin'] ?? null;
    }

    // Menjaga endpoint: menghentikan dengan 401 bila belum masuk.
    public static function wajib(): array
    {
        $sesi = self::sesi();
        if (!$sesi) {
            Bantu::gagal('Perlu masuk sebagai admin.', 401);
        }
        return $sesi;
    }

    // Membuat hash sandi (dipakai installer / ganti sandi).
    public static function hash(string $sandi): string
    {
        return password_hash($sandi, PASSWORD_DEFAULT);
    }
}
