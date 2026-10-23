<?php
class BruteForceGuard
{
    private static string $dir = __DIR__ . '/../../logs/bruteforce';

    public static function check(string $key, int $limit = 10, int $window = 60): array
    {
        if (!is_dir(self::$dir)) {
            @mkdir(self::$dir, 0775, true);
        }
        $file = self::$dir . '/' . hash('sha256', $key) . '.json';
        $now = time();
        $data = ['count' => 0, 'window_start' => $now];
        if (is_file($file)) {
            $raw = @file_get_contents($file);
            $parsed = json_decode((string) $raw, true);
            if (is_array($parsed)) {
                $data = $parsed;
            }
        }
        if ($now - (int) $data['window_start'] > $window) {
            $data = ['count' => 0, 'window_start' => $now];
        }
        $data['count']++;
        @file_put_contents($file, json_encode($data), LOCK_EX);
        $limited = $data['count'] > $limit;
        if ($limited) {
            EventDispatcher::dispatch('auth.bruteforce', ['key' => $key, 'count' => $data['count']]);
        }
        return ['limited' => $limited, 'remaining' => max(0, $limit - $data['count']), 'retry_after' => max(0, $window - ($now - (int) $data['window_start']))];
    }
}
