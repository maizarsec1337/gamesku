<?php
class IncidentManager
{
    private static function file(): string
    {
        return (string) Config::get('incident_file', __DIR__ . '/../../logs/incidents.jsonl');
    }

    public static function create(string $title, string $severity = 'medium', array $meta = []): string
    {
        $id = 'INC-' . date('Ymd') . '-' . bin2hex(random_bytes(3));
        $row = [
            'id' => $id,
            'title' => $title,
            'severity' => $severity,
            'status' => 'detected',
            'created_at' => date('c'),
            'updated_at' => date('c'),
            'meta' => SecretInventory::redact($meta),
        ];
        $dir = dirname(self::file());
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents(self::file(), json_encode($row) . PHP_EOL, FILE_APPEND | LOCK_EX);
        AuditLog::record('incident.create', 'success', ['resource' => $id]);
        return $id;
    }

    public static function transition(string $id, string $status): bool
    {
        $allowed = ['detected', 'investigating', 'contained', 'resolved', 'closed'];
        if (!in_array($status, $allowed, true)) {
            return false;
        }
        $file = self::file();
        if (!is_file($file)) {
            return false;
        }
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $out = [];
        $found = false;
        foreach ($lines as $line) {
            $row = json_decode($line, true);
            if (is_array($row) && ($row['id'] ?? '') === $id) {
                $row['status'] = $status;
                $row['updated_at'] = date('c');
                $found = true;
            }
            $out[] = json_encode($row);
        }
        if ($found) {
            @file_put_contents($file, implode(PHP_EOL, $out) . PHP_EOL, LOCK_EX);
            AuditLog::record('incident.transition', 'success', ['resource' => $id, 'status' => $status]);
        }
        return $found;
    }

    public static function list(?string $status = null): array
    {
        $file = self::file();
        if (!is_file($file)) {
            return [];
        }
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $result = [];
        foreach ($lines as $line) {
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            if ($status && ($row['status'] ?? '') !== $status) {
                continue;
            }
            $result[] = $row;
        }
        return $result;
    }
}
