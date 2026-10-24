<?php
// Konfigurasi terpusat security-service.
class Config
{
    private static array $config = [];
    private static bool $booted = false;

    public static function load(array $override = []): array
    {
        $base = [
            'env' => getenv('GAMEKU_ENV') ?: 'development',
            'debug' => getenv('GAMEKU_DEBUG') === '1',
            'secure_cookie' => getenv('GAMEKU_SECURE_COOKIE') === '1',
            'log_dir' => __DIR__ . '/../../logs',
            'audit_file' => __DIR__ . '/../../logs/security-audit.jsonl',
            'incident_file' => __DIR__ . '/../../logs/incidents.jsonl',
            'threat_thresholds' => [
                'login_failures' => 10,
                'http_4xx' => 20,
                'http_5xx' => 5,
                'window_seconds' => 300,
            ],
            'password_policy' => [
                'min_length' => 8,
                'require_upper' => true,
                'require_lower' => true,
                'require_digit' => true,
                'require_symbol' => false,
            ],
            'rbac' => [
                'admin' => ['*' => true],
                'superadmin' => ['*' => true],
                'pelanggan' => ['profil.baca', 'pesanan.baca_milik', 'reseller.ajukan'],
                'reseller' => ['profil.baca', 'pesanan.baca_milik', 'reseller.dashboard'],
            ],
        ];
        self::$config = array_replace_recursive($base, $override);
        self::$booted = true;
        self::validate();
        return self::$config;
    }

    public static function validate(): void
    {
        if (!self::$booted) {
            self::load();
        }
        $cfg = self::$config;
        $errors = [];
        if (!in_array($cfg['env'], ['development', 'testing', 'production'], true)) {
            $errors[] = 'env tidak valid';
        }
        if ($cfg['env'] === 'production' && $cfg['debug']) {
            $errors[] = 'debug tidak boleh aktif di production';
        }
        if (!is_dir(dirname($cfg['audit_file']))) {
            @mkdir(dirname($cfg['audit_file']), 0775, true);
        }
        if ($errors !== []) {
            throw new RuntimeException('Konfigurasi security-service tidak valid: ' . implode('; ', $errors));
        }
    }

    public static function get(string $key, $default = null)
    {
        if (!self::$booted) {
            self::load();
        }
        $segments = explode('.', $key);
        $val = self::$config;
        foreach ($segments as $seg) {
            if (is_array($val) && array_key_exists($seg, $val)) {
                $val = $val[$seg];
            } else {
                return $default;
            }
        }
        return $val;
    }

    public static function all(): array
    {
        if (!self::$booted) {
            self::load();
        }
        return self::$config;
    }
}

