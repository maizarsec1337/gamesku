<?php
class BackendIntegration
{
    public static function boot(array $override = []): void
    {
        Kernel::boot($override);
        SecurityHeaders::apply();
    }

    public static function auditRequest(string $action, string $outcome, array $meta = []): void
    {
        AuditLog::record($action, $outcome, $meta);
    }
}
