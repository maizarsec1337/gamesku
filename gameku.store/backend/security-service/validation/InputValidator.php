<?php
class InputValidator
{
    public static function email(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function int($value, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): ?int
    {
        $v = filter_var($value, FILTER_VALIDATE_INT);
        if ($v === false) {
            return null;
        }
        if ($v < $min || $v > $max) {
            return null;
        }
        return $v;
    }

    public static function safePath(string $path): bool
    {
        return strpos($path, '..') === false && strpos($path, "\0") === false;
    }
}
