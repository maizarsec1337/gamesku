<?php
class CsrfService
{
    public static function token(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            SessionManager::start();
        }
        if (empty($_SESSION['_csrf_token'])) {
            $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['_csrf_token'];
    }

    public static function validate(?string $token): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return false;
        }
        $expected = $_SESSION['_csrf_token'] ?? '';
        return is_string($token) && $expected !== '' && hash_equals($expected, $token);
    }
}
