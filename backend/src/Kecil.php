<?php
// Utilitas validasi input dan encoding output.

class Kecil
{
    public static function isSlug(string $value): bool
    {
        return preg_match('/^[a-z0-9-]+$/', $value) === 1;
    }

    public static function angkaValid(int $value, int $min = 0, int $max = PHP_INT_MAX): bool
    {
        return $value >= $min && $value <= $max;
    }

    public static function emailValid(?string $email): bool
    {
        if ($email === null || $email === '') {
            return true;
        }
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function idValid(string $id): bool
    {
        return preg_match('/^[a-zA-Z0-9-_]{1,40}$/', $id) === 1;
    }

    // Escape HTML entities.
    public static function htmlEncode(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function attrEncode(string $value): string
    {
        return str_replace(['&', '"', "'", '<', '>'], ['&amp;', '&quot;', '&#039;', '&lt;', '&gt;'], $value);
    }

    public static function isIntegerString(string $value): bool
    {
        return preg_match('/^-?\d+$/', $value) === 1;
    }

    public static function isInEnum(string $value, array $allowed): bool
    {
        return in_array($value, $allowed, true);
    }

    // Deteksi mencurigakan: kata kunci injeksi umum di parameter query.
    public static function isSuspicious(string $ip, array $query): bool
    {
        $suspiciousPatterns = [
            'union', 'select', 'insert', 'update', 'delete', 'drop', 'alter',
            'create', 'truncate', 'exec', 'execute', 'script', 'javascript',
            '<script', 'onerror', 'onload', 'eval', 'alert',
        ];
        foreach ($query as $v) {
            $str = strtolower((string) $v);
            foreach ($suspiciousPatterns as $pat) {
                if (strpos($str, $pat) !== false) {
                    return true;
                }
            }
        }
        return false;
    }
}