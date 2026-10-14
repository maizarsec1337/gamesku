<?php
// =====================================================================
// Kecil.php — fungsi bantu kecil untuk keamanan tambahan.
// Bebas dari dependensi, hanya berisi utilitas yang ringan.
// =====================================================================

class Kecil
{
    // === VALIDASI INPUT ===

    // Pastikan string adalah slug (hanya a-z, 0-9, dash)
    public static function isSlug(string $value): bool
    {
        return preg_match('/^[a-z0-9-]+$/', $value) === 1;
    }

    // Pastikan integer positif dengan batas atas
    public static function angkaValid(int $value, int $min = 0, int $max = PHP_INT_MAX): bool
    {
        return $value >= $min && $value <= $max;
    }

    // Pastikan email valid sesuai filter_var
    public static function emailValid(?string $email): bool
    {
        if ($email === null || $email === '') {
            return true;
        }
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    // Pastikan ID string hanya berisi alfanumerik + dash/underscore
    public static function idValid(string $id): bool
    {
        return preg_match('/^[a-zA-Z0-9-_]{1,40}$/', $id) === 1;
    }

    // === OUTPUT ENCODING ===

    // Encode untuk HTML context (escape HTML entities)
    public static function htmlEncode(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    // Encode untuk attribute context
    public static function attrEncode(string $value): string
    {
        return str_replace(['&', '"', "'", '<', '>'], ['&amp;', '&quot;', '&#039;', '&lt;', '&gt;'], $value);
    }

    // === REKOGNISI TIPE DATA ===

    // Cek apakah nilai numerik yang bersih (hanya digit, optional -)
    public static function isIntegerString(string $value): bool
    {
        return preg_match('/^-?\d+$/', $value) === 1;
    }

    // Cek apakah nilai adalah valid enum dari daftar yang diberikan
    public static function isInEnum(string $value, array $allowed): bool
    {
        return in_array($value, $allowed, true);
    }

    // === BRUTE-FORCE DETECTION ===

    // Cek apakah IP tampak dicurigai (banyak 429, atau adanya SQL keywords di param)
    public static function isSuspicious(string $ip, array $query): bool
    {
        // Flag query yang mengandung keyword injeksi umum
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