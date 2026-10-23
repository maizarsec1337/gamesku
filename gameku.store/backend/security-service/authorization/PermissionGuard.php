<?php
class PermissionGuard
{
    public static function check(?array $identity, string $permission): bool
    {
        if (!$identity) {
            return false;
        }
        $role = (string) ($identity['role'] ?? $identity['peran'] ?? '');
        return Rbac::hasPermission($role, $permission);
    }

    public static function require(?array $identity, string $permission): void
    {
        if (!self::check($identity, $permission)) {
            throw new RuntimeException('Akses ditolak.');
        }
    }
}
