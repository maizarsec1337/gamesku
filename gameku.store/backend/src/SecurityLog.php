<?php
// Security logging terstruktur (JSON lines) untuk insiden keamanan.
// Menulis ke logs/security.log — TIDAK pernah mencatat password, token,
// cookie, atau data pembayaran. Setiap baris memuat request ID untuk penelusuran.

class SecurityLog
{
    private const FILE = __DIR__ . '/../logs/security.log';

    // Daftar kunci yang tidak boleh ikut tercatat meski ada di konteks.
    private const FORBIDDEN_KEYS = [
        'password', 'pass', 'sandi', 'sandi_hash', 'token', 'csrf', 'cookie',
        'authorization', 'api_key', 'apikey', 'secret', 'key',
        'card', 'cc', 'cvv', 'rekening', 'kartu',
    ];

    /**
     * Catat satu peristiwa keamanan.
     *
     * @param string $jenis  Jenis peristiwa: 'login_gagal','login_sukses','akses_ditolak',
     *                       'csrf_ditolak','rate_limit','admin_nonaktif','idor_ditolak',
     *                       'validasi_gagal','upload_ditolak','transportasi', dst.
     * @param string $tingkat debug|info|warn|error
     * @param string $pesan   Pesan manusiawi (tanpa rahasia).
     * @param array  $konteks Data tambahan yang sudah disanitasi.
     */
    public static function catat(string $jenis, string $tingkat = 'info', string $pesan = '', array $konteks = []): void
    {
        try {
            $dir = dirname(self::FILE);
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }

            $baris = [
                'ts'        => date('c'),
                'tingkat'   => $tingkat,
                'jenis'     => $jenis,
                'pesan'     => $pesan,
                'requestId' => Bantu::requestId(),
                'ip'        => self::ipAman(),
                'metode'    => $_SERVER['REQUEST_METHOD'] ?? '',
                'path'      => self::pathAman(),
                'admin'     => $_SESSION['admin']['pengguna'] ?? null,
            ];

            if ($konteks !== []) {
                $baris['konteks'] = self::sanitasi($konteks);
            }

            $json = json_encode($baris, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                return;
            }

            // Append atomik dengan LOCK_EX; rotasi bila > 5 MB.
            if (is_file(self::FILE) && filesize(self::FILE) > 5 * 1024 * 1024) {
                @rename(self::FILE, self::FILE . '.' . date('Ymd-His') . '.1');
            }
            @file_put_contents(self::FILE, $json . PHP_EOL, FILE_APPEND | LOCK_EX);
        } catch (Throwable $e) {
            // Logging bersifat sampingan; kegagalan diabaikan agar request tidak rusak.
        }
    }

    // Sanitasi rekursif: buang/redaksi nilai pada kunci terlarang.
    private static function sanitasi(array $data, int $kedalaman = 0): array
    {
        if ($kedalaman > 4) {
            return [];
        }
        $hasil = [];
        foreach ($data as $kunci => $nilai) {
            $rendah = strtolower((string) $kunci);
            $terlarang = false;
            foreach (self::FORBIDDEN_KEYS as $fk) {
                if (strpos($rendah, $fk) !== false) {
                    $terlarang = true;
                    break;
                }
            }
            if ($terlarang) {
                $hasil[$kunci] = '[REDACTED]';
                continue;
            }
            if (is_array($nilai)) {
                $hasil[$kunci] = self::sanitasi($nilai, $kedalaman + 1);
            } elseif (is_scalar($nilai) || $nilai === null) {
                $hasil[$kunci] = is_string($nilai) ? Bantu::potong($nilai, 300) : $nilai;
            }
        }
        return $hasil;
    }

    // IP yang tervalidasi (header X-Forwarded-For hanya dihormati bila di belakang proxy tepercaya).
    private static function ipAman(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        // Bila dikonfigurasi di belakang proxy (env GAMEKU_TRUST_PROXY=1), hormati XFF pertama.
        if (getenv('GAMEKU_TRUST_PROXY') === '1') {
            $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
            if (is_string($xff) && $xff !== '') {
                $kandidat = trim(explode(',', $xff)[0]);
                if (filter_var($kandidat, FILTER_VALIDATE_IP)) {
                    $ip = $kandidat;
                }
            }
        }
        return substr((string) $ip, 0, 45);
    }

    private static function pathAman(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        // Buang query string agar token/sandi di URL tidak ikut tercatat.
        $path = (string) parse_url($uri, PHP_URL_PATH);
        return substr($path, 0, 200);
    }
}
