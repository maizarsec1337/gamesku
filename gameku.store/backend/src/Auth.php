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
            'SELECT status, peran FROM admin WHERE id = ? AND status = ? LIMIT 1',
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
        // Sinkronkan peran sesi dengan database (perubahan peran langsung berlaku).
        $peran = (string) ($baris['peran'] ?? '');
        if ($peran !== '' && (string) ($_SESSION['admin']['peran'] ?? '') !== $peran) {
            $_SESSION['admin']['peran'] = $peran;
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
        // Terima login dengan username ATAU email (mis. email pemilik project).
        $baris = Database::satu(
            'SELECT id, pengguna, nama, sandi_hash, status, peran FROM admin
             WHERE pengguna = ? OR email = ? LIMIT 1',
            [$pengguna, $pengguna]
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
        $peran = (string) ($baris['peran'] ?? '') !== '' ? (string) $baris['peran'] : 'admin';
        $_SESSION['admin'] = [
            'id'      => (int) $baris['id'],
            'pengguna'=> $baris['pengguna'],
            'nama'    => $baris['nama'],
            'peran'   => $peran,
        ];
        // Rotasi token CSRF setelah login (token pra-login tidak lagi berlaku).
        self::buatTokenCsrf(true);

        SecurityLog::catat('login_sukses', 'info', 'Admin berhasil masuk.', [
            'adminId' => (int) $baris['id'],
            'pengguna' => $baris['pengguna'],
            'peran' => $peran,
        ]);

        return [
            'berhasil' => true,
            'data'     => [
                'id' => (int) $baris['id'],
                'pengguna' => $baris['pengguna'],
                'nama' => $baris['nama'],
                'peran' => $peran,
            ],
        ];
    }

    public static function keluar(): void
    {
        self::keluarSesiPaksa();
    }

    public static function sesi(): ?array
    {
        self::mulai();
        $sesi = $_SESSION['admin'] ?? null;
        if ($sesi) {
            // cekStatusAktif() dapat menyegarkan peran di $_SESSION — kembalikan
            // nilai terbaru, bukan salinan sebelum pemeriksaan.
            self::cekStatusAktif($sesi);
            return $_SESSION['admin'] ?? null;
        }
        return null;
    }

    // Menghentikan request dengan 401 bila belum masuk.
    // Percobaan akses ke endpoint terproteksi dicatat sebagai insiden.
    public static function wajib(): array
    {
        return self::wajibPeran(null);
    }

    // Menghentikan request dengan 401 bila belum masuk, atau 403 bila
    // peran sesi tidak cocok dengan $peran yang diharapkan (null = semua role).
    public static function wajibPeran(?string $peran = null): array
    {
        $sesi = self::sesi();
        if (!$sesi) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Endpoint terproteksi diakses tanpa sesi admin valid.', [
                'path' => (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            ]);
            Bantu::gagal('Perlu masuk sebagai admin.', 401);
        }
        if ($peran !== null && (string) ($sesi['peran'] ?? '') !== $peran) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Role tidak mencukupi untuk endpoint ini.', [
                'path'    => (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
                'roleSesi' => (string) ($sesi['peran'] ?? ''),
                'roleDiperlukan' => $peran,
            ]);
            Bantu::gagal('Akses ditolak: role tidak cukup.', 403);
        }
        return $sesi;
    }

    // Pre-check CSRF: membandingkan token dengan milik sesi (hash_equals).
    public static function cekCsrf(string $token): bool
    {
        $persegi = $_SESSION['_csrf_token'] ?? null;
        return is_string($persegi) && is_string($token) && hash_equals($persegi, $token);
    }

    // Ambil token CSRF aktif. Idempoten: token sesi yang sudah ada dipakai ulang
    // agar beberapa tab/klien tidak saling membatalkan token (tanpa rotasi liar).
    // Gunakan $paksa = true hanya untuk merotasi token (mis. tepat setelah login).
    public static function buatTokenCsrf(bool $paksa = false): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::mulai();
        }
        if (!$paksa && isset($_SESSION['_csrf_token']) && is_string($_SESSION['_csrf_token'])
            && $_SESSION['_csrf_token'] !== '') {
            return $_SESSION['_csrf_token'];
        }
        $token = bin2hex(random_bytes(32));
        $_SESSION['_csrf_token'] = $token;
        return $token;
    }

    public static function hash(string $sandi): string
    {
        return password_hash($sandi, PASSWORD_DEFAULT);
    }

    // ============ SESI PEMBELI (toko depan) — terpisah dari sesi admin. ============
    // Memakai tabel `pelanggan` yang SUDAH ADA (kolom sandi_hash nullable).
    // Kunci sesi: $_SESSION['pembeli'] (bukan 'admin') agar peran tidak tercampur:
    // sesi pembeli TIDAK lolos Auth::wajib()/wajibPeran() admin.
    public static function masukPembeli(string $email, string $sandi): array
    {
        $baris = Database::satu(
            'SELECT id, nama, username, email, sandi_hash, status FROM pelanggan WHERE email = ? LIMIT 1',
            [$email]
        );

        // Pesan samar agar email yang ada tidak bocor; akun tanpa sandi
        // (daftar cepat lama) juga ditolak dengan pesan yang sama.
        if (!$baris || !is_string($baris['sandi_hash'] ?? null) || $baris['sandi_hash'] === ''
            || !password_verify($sandi, $baris['sandi_hash'])) {
            SecurityLog::catat('login_pembeli_gagal', 'warn', 'Percobaan masuk pembeli gagal.', [
                'emailAda' => $baris !== null,
            ]);
            return ['berhasil' => false, 'pesan' => 'Email atau kata sandi salah.'];
        }
        if (($baris['status'] ?? 'Aktif') !== 'Aktif') {
            SecurityLog::catat('login_pembeli_gagal', 'warn', 'Masuk ditolak: akun pembeli tidak aktif.', [
                'email' => $baris['email'] ?? '',
            ]);
            return ['berhasil' => false, 'pesan' => 'Akun tidak aktif.'];
        }

        session_regenerate_id(true);
        $_SESSION['pembeli'] = [
            'id'       => (string) $baris['id'],
            'nama'     => (string) ($baris['nama'] ?? ''),
            'username' => (string) ($baris['username'] ?? ''),
            'email'    => (string) ($baris['email'] ?? ''),
        ];
        // Rotasi token CSRF setelah login pembeli.
        self::buatTokenCsrf(true);

        SecurityLog::catat('login_pembeli_sukses', 'info', 'Pembeli berhasil masuk.', [
            'pembeliId' => (string) $baris['id'],
        ]);

        return [
            'berhasil' => true,
            'data'     => $_SESSION['pembeli'],
        ];
    }

    public static function keluarPembeli(): void
    {
        self::mulai();
        unset($_SESSION['pembeli']);
    }

    public static function sesiPembeli(): ?array
    {
        self::mulai();
        $sesi = $_SESSION['pembeli'] ?? null;
        if (!is_array($sesi)) return null;
        // Cek ulang status akun tiap request: Nonaktif langsung mengakhiri sesi.
        try {
            $baris = Database::satu(
                'SELECT id, nama, username, email FROM pelanggan WHERE id = ? AND status = ? LIMIT 1',
                [(string) ($sesi['id'] ?? ''), 'Aktif']
            );
        } catch (Throwable $e) {
            return $sesi;
        }
        if (!$baris) {
            unset($_SESSION['pembeli']);
            return null;
        }
        // Segarkan nama/username/email bila berubah di database.
        $_SESSION['pembeli'] = [
            'id'       => (string) $baris['id'],
            'nama'     => (string) ($baris['nama'] ?? ''),
            'username' => (string) ($baris['username'] ?? ''),
            'email'    => (string) ($baris['email'] ?? ''),
        ];
        return $_SESSION['pembeli'];
    }

    // Identitas sesi yang sedang aktif: admin diutamakan, lalu pembeli.
    // Mengembalikan ['tipe' => 'admin'|'pembeli', 'id' => string, 'nama' => string]
    // atau null bila tidak ada sesi. Dipakai endpoint yang melayani keduanya
    // (mis. pesan/percakapan).
    public static function identitas(): ?array
    {
        $admin = self::sesi();
        if ($admin) {
            return [
                'tipe' => 'admin',
                'id'   => (string) $admin['id'],
                'nama' => (string) ($admin['nama'] ?? $admin['pengguna'] ?? ''),
            ];
        }
        $pembeli = self::sesiPembeli();
        if ($pembeli) {
            return [
                'tipe' => 'pembeli',
                'id'   => (string) $pembeli['id'],
                'nama' => (string) ($pembeli['nama'] ?? ''),
            ];
        }
        return null;
    }

    // Hentikan request dengan 401 bila tidak ada sesi (admin maupun pembeli).
    public static function wajibIdentitas(): array
    {
        $id = self::identitas();
        if (!$id) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Endpoint pesan diakses tanpa sesi.', [
                'path' => (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            ]);
            Bantu::gagal('Perlu masuk terlebih dahulu.', 401);
        }
        return $id;
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
