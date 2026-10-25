<?php
class Rbac
{
    public static function hasPermission(string $role, string $permission): bool
    {
        $perms = Config::get('rbac.' . $role, []);
        if (!is_array($perms)) {
            return false;
        }
        if (isset($perms['*'])) {
            return true;
        }
        return in_array($permission, $perms, true);
    }

    public static function assert(string $role, string $permission): void
    {
        if (!self::hasPermission($role, $permission)) {
            throw new RuntimeException('Akses ditolak: permission tidak cukup.');
        }
    }
}
