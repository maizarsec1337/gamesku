<?php
// Autentikasi admin berbasis sesi PHP (password_hash / password_verify).

class Auth
{
    // Cookie 'secure'. Tidak dapat berupa const: getenv() bukan ekspresi konstan
    // (const berisi panggilan fungsi = fatal error di PHP mana pun). Perilaku
    // dipertahankan sama persis dengan ekspresi lama: env GAMEKU_SECURE_COOKIE
    // di-set → (bool) nilainya; tidak ada env → false.
    private static function cookieSecure(): bool
    {
        $v = getenv('GAMEKU_SECURE_COOKIE');
        return $v === false ? false : (bool) $v;
    }

    public static function mulai(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            // 'lifetime' (bukan 'max_lifetime'): kunci lama hanya memicu warning
            // session_set_cookie_params() pada PHP 7.3+ tanpa efek.
            session_set_cookie_params([
                'lifetime'     => 1800,
                'path'         => '/',
                'httponly'     => true,
                'samesite'     => 'Lax',
                'secure'       => self::cookieSecure(),
            ]);
            session_start();
        }
    }

    // Cek ulang status admin tiap request: akun Nonaktif langsung mengakhiri sesi.
    private static function cekStatusAktif(array $sesi): void
    {
        $baris = Database::satu(
            'SELECT status FROM admin WHERE id = ? AND status = ? LIMIT 1',
            [(int) $sesi['id'], 'Aktif']
        );
        if (!$baris) {
            SecurityLog::catat('admin_nonaktif', 'warn', 'Sesi admin dihentikan karena akun tidak aktif/dihapus.', [
                'adminId' => (int) ($sesi['id'] ?? 0),
                'pengguna' => (string) ($sesi['pengguna'] ?? ''),
            ]);
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
        }
    }

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

    public static function masuk(string $pengguna, string $sandi): array
    {
        $baris = Database::satu(
            'SELECT id, pengguna, nama, sandi_hash, status FROM admin WHERE pengguna = ? LIMIT 1',
            [$pengguna]
        );

        // Pesan samar agar akun yang ada tidak bocor.
        if (!$baris || !password_verify($sandi, $baris['sandi_hash'])) {
            // Log kegagalan login (tanpa sandi) — memantau brute force.
            SecurityLog::catat('login_gagal', 'warn', 'Percobaan login gagal.', [
                'penggunaDiketik' => Bantu::potong($pengguna, 60),
                'akunAda' => $baris !== null,
            ]);
            return ['berhasil' => false, 'pesan' => 'Pengguna atau sandi salah.'];
        }
        if (($baris['status'] ?? 'Aktif') !== 'Aktif') {
            SecurityLog::catat('login_gagal', 'warn', 'Login ditolak: akun admin tidak aktif.', [
                'pengguna' => $baris['pengguna'] ?? '',
            ]);
            return ['berhasil' => false, 'pesan' => 'Akun admin tidak aktif.'];
        }

        // Regenerasi ID sesi sebelum mengikat data (cegah session fixation).
        session_regenerate_id(true);
        $_SESSION['admin'] = [
            'id'      => (int) $baris['id'],
            'pengguna'=> $baris['pengguna'],
            'nama'    => $baris['nama'],
        ];

        SecurityLog::catat('login_sukses', 'info', 'Admin berhasil masuk.', [
            'adminId' => (int) $baris['id'],
            'pengguna' => $baris['pengguna'],
        ]);

        return [
            'berhasil' => true,
            'data'     => ['id' => (int) $baris['id'], 'pengguna' => $baris['pengguna'], 'nama' => $baris['nama']],
        ];
    }

    public static function keluar(): void
    {
        self::mulai();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', self::cookieSecure(), true);
        }
        session_destroy();
        self::keluarSesiPaksa();
    }

    public static function sesi(): ?array
    {
        self::mulai();
        $sesi = $_SESSION['admin'] ?? null;
        if ($sesi) {
            self::cekStatusAktif($sesi);
        }
        return $sesi;
    }

    // Menghentikan request dengan 401 bila belum masuk.
    // Percobaan akses ke endpoint terproteksi dicatat sebagai insiden.
    public static function wajib(): array
    {
        $sesi = self::sesi();
        if (!$sesi) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Endpoint terproteksi diakses tanpa sesi admin valid.', [
                'path' => (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            ]);
            Bantu::gagal('Perlu masuk sebagai admin.', 401);
        }
        return $sesi;
    }

    // Pre-check CSRF: membandingkan token dengan milik sesi (hash_equals).
    public static function cekCsrf(string $token): bool
    {
        $persegi = $_SESSION['_csrf_token'] ?? null;
        return is_string($persegi) && is_string($token) && hash_equals($persegi, $token);
    }

    public static function buatTokenCsrf(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::mulai();
        }
        $token = bin2hex(random_bytes(32));
        $_SESSION['_csrf_token'] = $token;
        return $token;
    }

    public static function hash(string $sandi): string
    {
        return password_hash($sandi, PASSWORD_DEFAULT);
    }
}

// Rate limiter login: hitungan per IP di FILE (bukan session) — window 60 detik, maks 10.
// Session-based dapat dibobol dengan membawa session baru; file-based mengikat ke IP.
class AuthRateLimiter
{
    private const WINDOW = 60;
    private const MAX_REQUESTS = 10;

    public static function check(?string $key = null): array
    {
        $ip = RateLimiter::ip();
        $hasil = RateLimiter::check('login', $ip, self::MAX_REQUESTS, self::WINDOW);
        if ($hasil['limited']) {
            SecurityLog::catat('rate_limit', 'warn', 'Login dibatasi: melebihi percobaan maksimal.', [
                'bucket' => 'login',
                'retryAfter' => $hasil['retry_after'],
            ]);
        }
        return $hasil;
    }

    // Reset counter setelah login sukses (agar user sah tidak terkunci
    // oleh percobaan salah sebelumnya dari IP sama).
    public static function reset(): void
    {
        try {
            $file = __DIR__ . '/../logs/ratelimit/login_' . hash('sha256', 'login|' . RateLimiter::ip()) . '.json';
            if (is_file($file)) {
                @unlink($file);
            }
        } catch (Throwable $e) {
        }
    }
}
