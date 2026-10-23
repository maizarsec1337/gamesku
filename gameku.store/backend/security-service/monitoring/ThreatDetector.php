<?php
class ThreatDetector
{
    private static function file(): string
    {
        return __DIR__ . '/../../logs/threat-events.jsonl';
    }

    public static function record(string $type, array $meta = []): void
    {
        $row = ['ts' => time(), 'type' => $type, 'meta' => $meta];
        $dir = dirname(self::file());
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents(self::file(), json_encode($row) . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    public static function analyze(): array
    {
        $file = self::file();
        if (!is_file($file)) {
            return [];
        }
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $now = time();
        $window = (int) Config::get('threat_thresholds.window_seconds', 300);
        $thresholds = Config::get('threat_thresholds', []);
        $counts = [];
        foreach ($lines as $line) {
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            if ($now - (int) $row['ts'] > $window) {
                continue;
            }
            $type = (string) $row['type'];
            $counts[$type] = ($counts[$type] ?? 0) + 1;
        }
        $findings = [];
        if (($counts['login_fail'] ?? 0) >= (int) ($thresholds['login_failures'] ?? 10)) {
            $findings[] = ['type' => 'login_spike', 'severity' => 'high', 'count' => $counts['login_fail']];
        }
        if (($counts['http_4xx'] ?? 0) >= (int) ($thresholds['http_4xx'] ?? 20)) {
            $findings[] = ['type' => 'http_4xx_spike', 'severity' => 'medium', 'count' => $counts['http_4xx']];
        }
        if (($counts['http_5xx'] ?? 0) >= (int) ($thresholds['http_5xx'] ?? 5)) {
            $findings[] = ['type' => 'http_5xx_spike', 'severity' => 'high', 'count' => $counts['http_5xx']];
        }
        return $findings;
    }
}
