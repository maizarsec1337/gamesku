<?php
class SecurityHeaders
{
    public static function apply(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Content-Security-Policy: default-src \'none\'; frame-ancestors \'none\'');
        header('Cross-Origin-Opener-Policy: same-origin');
    }
}
