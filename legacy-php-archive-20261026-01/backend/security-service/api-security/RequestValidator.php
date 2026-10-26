<?php
class RequestValidator
{
    public static function validateJsonSize(int $max = 262144): void
    {
        $raw = file_get_contents('php://input') ?: '';
        if (strlen($raw) > $max) {
            throw new RuntimeException('Payload terlalu besar.');
        }
    }

    public static function requireFields(array $data, array $fields): void
    {
        foreach ($fields as $f) {
            if (!array_key_exists($f, $data) || $data[$f] === null || $data[$f] === '') {
                throw new RuntimeException("Field wajib: {$f}");
            }
        }
    }

    public static function sanitizeString($value, int $max = 500): string
    {
        return mb_substr(trim((string) $value), 0, $max);
    }
}
