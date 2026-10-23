<?php
class AuditLog
{
    private static function requestId(): string
    {
        static $id = null;
        if ($id === null) {
            $id = 'req-' . bin2hex(random_bytes(8));
        }
        return $id;
    }

    private static function file(): string
    {
        return (string) Config::get('audit_file', __DIR__ . '/../../logs/security-audit.jsonl');
    }

    public static function record(string $action, string $outcome, array $meta = []): void
    {
        $row = [
            'ts' => date('c'),
            'correlation_id' => self::requestId(),
            'actor' => $_SESSION['admin']['pengguna'] ?? ($_SESSION['pembeli']['id'] ?? null),
            'action' => $action,
            'resource' => $meta['resource'] ?? null,
            'outcome' => $outcome,
            'meta' => SecretInventory::redact($meta),
        ];
        $file = self::file();
        $dir = dirname($file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents($file, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
        EventDispatcher::dispatch('audit.recorded', $row);
    }

    public static function search(array $filters = [], int $limit = 100): array
    {
        $file = self::file();
        if (!is_file($file)) {
            return [];
        }
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $result = [];
        foreach (array_reverse($lines) as $line) {
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            if (!self::match($row, $filters)) {
                continue;
            }
            $result[] = $row;
            if (count($result) >= $limit) {
                break;
            }
        }
        return $result;
    }

    private static function match(array $row, array $filters): bool
    {
        foreach ($filters as $k => $v) {
            if ($v === null || $v === '') {
                continue;
            }
            if (!isset($row[$k]) || $row[$k] != $v) {
                return false;
            }
        }
        return true;
    }
}
