<?php
class SecretInventory
{
    public static function requiredEnv(): array
    {
        return ['GAMEKU_DB_HOST', 'GAMEKU_DB_NAME', 'GAMEKU_DB_USER'];
    }

    public static function check(): array
    {
        $missing = [];
        foreach (self::requiredEnv() as $key) {
            $val = getenv($key);
            if ($val === false || $val === '') {
                $missing[] = $key;
            }
        }
        return ['missing' => $missing, 'ok' => $missing === []];
    }

    public static function redact(array $data): array
    {
        $sensitive = ['password', 'token', 'secret', 'api_key', 'key'];
        foreach ($data as $k => $v) {
            foreach ($sensitive as $s) {
                if (stripos((string) $k, $s) !== false) {
                    $data[$k] = '[REDACTED]';
                }
            }
            if (is_array($v)) {
                $data[$k] = self::redact($v);
            }
        }
        return $data;
    }
}
