<?php
class PasswordPolicy
{
    public static function validate(string $password): array
    {
        $errors = [];
        $min = (int) Config::get('password_policy.min_length', 8);
        if (strlen($password) < $min) {
            $errors[] = "minimal {$min} karakter";
        }
        if (Config::get('password_policy.require_upper') && !preg_match('/[A-Z]/', $password)) {
            $errors[] = 'harus ada huruf besar';
        }
        if (Config::get('password_policy.require_lower') && !preg_match('/[a-z]/', $password)) {
            $errors[] = 'harus ada huruf kecil';
        }
        if (Config::get('password_policy.require_digit') && !preg_match('/\d/', $password)) {
            $errors[] = 'harus ada angka';
        }
        if (Config::get('password_policy.require_symbol') && !preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors[] = 'harus ada simbol';
        }
        return $errors;
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID) ?: password_hash($password, PASSWORD_BCRYPT);
    }

    public static function verify(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }
}
