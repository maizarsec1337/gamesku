<?php
// Autoloader minimal untuk security-service.
$ssRoot = __DIR__;
$folders = [
    'core', 'auth', 'authorization', 'api-security', 'validation',
    'rate-limiting', 'security-headers', 'csrf', 'secrets', 'audit',
    'monitoring', 'threat-detection', 'vulnerability-scanning',
    'dependency-audit', 'incident-response', 'integrations',
];

spl_autoload_register(function ($class) use ($ssRoot, $folders) {
    $simple = str_replace(['Gameku\\Security\\', 'Security_'], ['', ''], $class);
    $simple = str_replace('\\', '/', $simple);
    foreach ($folders as $f) {
        $path = $ssRoot . '/' . $f . '/' . $simple . '.php';
        if (is_file($path)) {
            require_once $path;
            return;
        }
        $path2 = $ssRoot . '/' . $f . '/' . basename($simple) . '.php';
        if (is_file($path2)) {
            require_once $path2;
            return;
        }
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ssRoot));
    foreach ($it as $file) {
        if ($file->isFile() && $file->getExtension() === 'php'
            && $file->getBasename('.php') === basename($simple)) {
            require_once $file->getPathname();
            return;
        }
    }
});
