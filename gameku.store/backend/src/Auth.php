<?php
// =====================================================================
// Auth.php — autentikasi admin berbasis sesi PHP.
// Password disimpan sebagai hash (password_hash / password_verify).
// Kredensial diperiksa di server, bukan di peramban.
// =====================================================================

class Auth
{
    private const COOKIE_SECURE = (bool) (getenv('GAMEKU_SECURE_COOKIE') ?? (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'));

    // Memulai sesi secara aman (hanya sekali).
    public static function mulai(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            // Cookie sesi: hanya HTTP, tidak terakses JS, SameSite Lax, path '/',
            // hanya dikirim di HTTPS (jika konfigurasi memaksa), dan timeout 30 menit.
            session_set_cookie_params([
                'httponly'     => true,
                'samesite'     => 'Lax',
                'path'         => '/',
                'secure'       => self::COOKIE_SECURE,
                'max_lifetime' => 1800,
            ]);
            session_start();
        }
    }

    // Cek ulang status admin setiap request — akun Nonaktif tidak boleh
    // membuat session tetap aktif (mencegah privilege escalation).
    private static function cekStatusAktif(array $sesi): void
    {
        $baris = Database::satu(
            'SELECT status FROM admin WHERE id = ? AND status = ? LIMIT 1',
            [(int) $sesi['id'], 'Aktif']
        );
        if (!$baris) {
            self::keluarSesiPaksa();
            return;
        }
        // Refresh waktu masuk terakhir.
        try {
            Database::eksekusi(
                'UPDATE admin SET masuk_terakhir = NOW() WHERE id = ?',
                [(int) $sesi['id']]
            );
        } catch (Throwable $e) {
            // Biarkan saja.
        }
    }

    // Hapus session paksa tanpa mengirimkan cookie ke klien.
    private static function keluarSesiPaksa(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', true, true);
        }
        session_destroy();
        session_start();
        $_SESSION = [];
        session_destroy();
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

        // Cegah session fixation: regenerasi ID sesi sebelum mengikat data.
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
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', self::COOKIE_SECURE, true);
        }
        session_destroy();
        self::keluarSesiPaksa();
    }

    // Data sesi admin yang sedang masuk (atau null).
    public static function sesi(): ?array
    {
        self::mulai();
        $sesi = $_SESSION['admin'] ?? null;
        if ($sesi) {
            self::cekStatusAktif($sesi);
        }
        return $sesi;
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

    // Memeriksa bahwa request datang dari sumber yang sama (sesi) — pre-check
    // untuk CSRF (dipanggil oleh PengendaliDasar).
    public static function cekCsrf(string $token): bool
    {
        $persegi = $_SESSION['_csrf_token'] ?? null;
        return is_string($persegi) && is_string($token) && hash_equals($persegi, $token);
    }

    // Membuat token CSRF baru untuk validasi state-changing request.
    public static function buatTokenCsrf(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::mulai();
        }
        $token = bin2hex(random_bytes(32));
        $_SESSION['_csrf_token'] = $token;
        return $token;
    }

    // Membuat hash sandi (dipakai installer / ganti sandi).
    public static function hash(string $sandi): string
    {
        return password_hash($sandi, PASSWORD_DEFAULT);
    }
}

// --- Rate limiting untuk endpoint /api/auth/masuk ---
// Menyimpan hit hitung per IP + key (user) dalam session, disegarkan per hit.
class AuthRateLimiter
{
    // Batas permintaan per 60 detik (untuk login).
    private const WINDOW = 60;
    private const MAX_REQUESTS = 10;

    // Refresh token di session setiap request. Gunakan sebagai store primitif.
    public static function check(?string $key = null): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            Auth::mulai();
        }
        $ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $window  = self::WINDOW;
        $max     = self::MAX_REQUESTS;
        $now     = time();
        $store   = &$_SESSION['_auth_rate'] ?? null;
        if (!is_array($store)) {
            $store = [];
        }

        // Siapkan kunci rolling untuk IP + key user.
        $ips = $store['ips'] ?? [];
        if (!is_array($ips)) {
            $ips = [];
            $store['ips'] = $ips;
        }

        // Tambahkan entri IP jika belum ada.
        if (!isset($ips[$ip])) {
            $ips[$ip] = ['count' => 0, 'window_start' => $now];
        }
        $entry = &$ips[$ip];

        // Reset jika window sudah lewat.
        if ($now - $entry['window_start'] > $window) {
            $entry = ['count' => 0, 'window_start' => $now];
        }

        $entry['count']++;
        $store['ips'] = $ips;
        $_SESSION['_auth_rate'] = $store;

        $remaining = $max - $entry['count'];
        if ($entry['count'] > $max) {
            return ['limited' => true, 'retry_after' => $window - (time() - $entry['window_start'])];
        }
        return ['limited' => false, 'remaining' => max(0, $remaining)];
    }
}
