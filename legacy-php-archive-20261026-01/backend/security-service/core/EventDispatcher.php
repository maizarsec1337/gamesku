<?php
class EventDispatcher
{
    private static array $listeners = [];

    public static function listen(string $event, callable $handler): void
    {
        self::$listeners[$event][] = $handler;
    }

    public static function dispatch(string $event, array $payload = []): void
    {
        foreach (self::$listeners[$event] ?? [] as $handler) {
            try {
                $handler($payload);
            } catch (Throwable $e) {
                Logger::error('event handler gagal', ['event' => $event, 'error' => $e->getMessage()]);
            }
        }
    }
}
