<?php
class DependencyAuditor
{
    public static function audit(string $root): array
    {
        $results = [];
        // PHP: composer audit (jika composer tersedia)
        $composer = $root . '/composer.json';
        if (is_file($composer)) {
            $results[] = ['tool' => 'composer', 'status' => 'not_run', 'note' => 'Jalankan composer audit secara manual.'];
        }
        // Node: npm audit
        if (is_file($root . '/package.json') || is_file($root . '/frontend/package.json')) {
            $results[] = ['tool' => 'npm', 'status' => 'not_run', 'note' => 'Jalankan npm audit secara manual.'];
        }
        return $results;
    }
}
