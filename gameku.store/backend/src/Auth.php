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
            session_set_cookie_params([
                'httponly'     => true,
                'samesite'     => 'Lax',
                'path'         => '/',
                'secure'       => self::cookieSecure(),
                'max_lifetime' => 1800,
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
            return ['berhasil' => false, 'pesan' => 'Pengguna atau sandi salah.'];
        }
        if (($baris['status'] ?? 'Aktif') !== 'Aktif') {
            return ['berhasil' => false, 'pesan' => 'Akun admin tidak aktif.'];
        }

        // Regenerasi ID sesi sebelum mengikat data (cegah session fixation).
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
    public static function wajib(): array
    {
        $sesi = self::sesi();
        if (!$sesi) {
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

// Rate limiter login: hitungan per IP dalam session (window 60 detik, maks 10).
class AuthRateLimiter
{
    private const WINDOW = 60;
    private const MAX_REQUESTS = 10;

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

        $ips = $store['ips'] ?? [];
        if (!is_array($ips)) {
            $ips = [];
            $store['ips'] = $ips;
        }

        if (!isset($ips[$ip])) {
            $ips[$ip] = ['count' => 0, 'window_start' => $now];
        }
        $entry = &$ips[$ip];

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
