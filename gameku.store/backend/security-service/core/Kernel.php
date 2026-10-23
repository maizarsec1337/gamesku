<?php
class Kernel
{
    private static bool $booted = false;

    public static function boot(array $override = []): void
    {
        if (self::$booted) {
            return;
        }
        Config::load($override);
        Logger::info('security-service boot', ['env' => Config::get('env')]);
        self::$booted = true;
        EventDispatcher::dispatch('security.booted', ['env' => Config::get('env')]);
    }

    public static function isBooted(): bool
    {
        return self::$booted;
    }
}
