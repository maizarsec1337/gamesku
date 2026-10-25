<?php
class Logger
{
    public static function log(string $level, string $message, array $context = []): void
    {
        $file = (string) Config::get('audit_file', __DIR__ . '/../../logs/security-audit.jsonl');
        $dir = dirname($file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $row = [
            'ts' => date('c'),
            'level' => $level,
            'message' => $message,
            'context' => $context,
        ];
        @file_put_contents($file, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    public static function info(string $m, array $c = []): void { self::log('info', $m, $c); }
    public static function warn(string $m, array $c = []): void { self::log('warn', $m, $c); }
    public static function error(string $m, array $c = []): void { self::log('error', $m, $c); }
}
