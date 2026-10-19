<?php
// Rate limiter berbasis IP tersimpan di file (bukan session).
// Keunggulan: tetap membatasi meski penyerang tidak mengirim cookie / selalu
// mengganti session — penyerang membawa counter-nya sendiri di session sebelumnya.
// Per file dijaga flock() agar penulisan pada window bersamaan tidak korup.

class RateLimiter
{
    private const DIR = __DIR__ . '/../logs/ratelimit';

    // Kunci aman nama file dari kombinasi bucket+key.
    private static function file(string $bucket, string $key): string
    {
        $hash = hash('sha256', $bucket . '|' . $key);
        return self::DIR . '/' . preg_replace('/[^a-f0-9]/', '', $bucket) . '_' . $hash . '.json';
    }

    /**
     * Tambah hitungan dan cek batas.
     *
     * @param string $bucket Kelompok limit (mis. 'login','write','chat).
     * @param string $key    Kunci unik, umumnya IP (atau IP+jalur).
     * @param int    $limit  Maks request per window.
     * @param int    $window Jendela waktu dalam detik.
     * @return array{limited:bool, remaining:int, retry_after:int}
     */
    public static function check(string $bucket, string $key, int $limit, int $window): array
    {
        try {
            if (!is_dir(self::DIR)) {
                @mkdir(self::DIR, 0775, true);
            }
            $file = self::file($bucket, $key);
            $now = time();

            $fp = @fopen($file, 'c+');
            if ($fp === false) {
                // Gagal membuka file: jangan blokir request (fail-open agar
                // gangguan disk tidak merusak layanan), tapi tetap catat.
                SecurityLog::catat('rate_limit_gagal', 'warn', 'Rate limiter storage tidak dapat diakses.');
                return ['limited' => false, 'remaining' => $limit, 'retry_after' => 0];
            }

            if (!flock($fp, LOCK_EX)) {
                fclose($fp);
                return ['limited' => false, 'remaining' => $limit, 'retry_after' => 0];
            }

            $isi = stream_get_contents($fp);
            $data = $isi !== false && $isi !== '' ? json_decode($isi, true) : null;
            if (!is_array($data) || !isset($data['count'], $data['window_start'])) {
                $data = ['count' => 0, 'window_start' => $now];
            }

            if ($now - (int) $data['window_start'] > $window) {
                $data = ['count' => 0, 'window_start' => $now];
            }

            $data['count'] = (int) $data['count'] + 1;

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data));
            fflush($fp);
            flock($fp, LOCK_UN);
            fclose($fp);

            $elapsed = $now - (int) $data['window_start'];
            $retryAfter = max(0, $window - $elapsed);

            if ($data['count'] > $limit) {
                return ['limited' => true, 'remaining' => 0, 'retry_after' => $retryAfter];
            }
            return ['limited' => false, 'remaining' => max(0, $limit - $data['count']), 'retry_after' => 0];
        } catch (Throwable $e) {
            // Fail-open: jangan sampai kegagalan rate limiter mematikan API.
            return ['limited' => false, 'remaining' => $limit, 'retry_after' => 0];
        }
    }

    // Hitung saja tanpa menambah (untuk pengecekan read-only).
    public static function peek(string $bucket, string $key, int $limit, int $window): array
    {
        $file = self::file($bucket, $key);
        if (!is_file($file)) {
            return ['limited' => false, 'remaining' => $limit];
        }
        $data = json_decode((string) @file_get_contents($file), true);
        if (!is_array($data) || !isset($data['count'], $data['window_start'])) {
            return ['limited' => false, 'remaining' => $limit];
        }
        if (time() - (int) $data['window_start'] > $window) {
            return ['limited' => false, 'remaining' => $limit];
        }
        $sisa = $limit - (int) $data['count'];
        return ['limited' => $sisa < 0, 'remaining' => max(0, $sisa)];
    }

    // Buang semua counter yang sudah kedaluwarsa (pembersihan ringan).
    public static function bersihkan(int $window = 3600): void
    {
        try {
            if (!is_dir(self::DIR)) {
                return;
            }
            foreach (glob(self::DIR . '/*.json') ?: [] as $file) {
                if (@filemtime($file) < time() - $window) {
                    @unlink($file);
                }
            }
        } catch (Throwable $e) {
        }
    }

    // IP klien (hanya REMOTE_ADDR; X-Forwarded-For hanya bila GAMEKU_TRUST_PROXY=1).
    public static function ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
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
}
