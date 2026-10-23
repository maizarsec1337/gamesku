<?php
class RateLimitService
{
    public static function check(string $bucket, string $key, int $limit, int $window): array
    {
        // Reuse existing RateLimiter if available.
        if (class_exists('RateLimiter')) {
            return RateLimiter::check($bucket, $key, $limit, $window);
        }
        // Fallback simple file-based.
        $dir = __DIR__ . '/../../logs/rl';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $file = $dir . '/' . hash('sha256', $bucket . '|' . $key) . '.json';
        $now = time();
        $data = ['count' => 0, 'window_start' => $now];
        if (is_file($file)) {
            $p = json_decode((string) @file_get_contents($file), true);
            if (is_array($p)) {
                $data = $p;
            }
        }
        if ($now - (int) $data['window_start'] > $window) {
            $data = ['count' => 0, 'window_start' => $now];
        }
        $data['count']++;
        @file_put_contents($file, json_encode($data), LOCK_EX);
        $limited = $data['count'] > $limit;
        return ['limited' => $limited, 'remaining' => max(0, $limit - $data['count']), 'retry_after' => max(0, $window - ($now - (int) $data['window_start']))];
    }
}
