<?php
declare(strict_types=1);
require_once __DIR__ . '/../autoload.php';

$pass = 0; $fail = 0;
function t(string $name, callable $fn): void {
    global $pass, $fail;
    try { $fn(); $pass++; echo "[PASS] $name\n"; }
    catch (Throwable $e) { $fail++; echo "[FAIL] $name: " . $e->getMessage() . "\n"; }
}
function ok(bool $c, string $m=''): void { if (!$c) throw new RuntimeException($m ?: 'assertion failed'); }

Config::load(['env'=>'testing']);
SessionManager::start();
t('config validates', fn() => ok(Config::get('env') === 'testing'));
t('password policy rejects weak', fn() => ok(PasswordPolicy::validate('abc') !== []));
t('password policy accepts strong', fn() => ok(PasswordPolicy::validate('Abcdef12') === []));
$hash = PasswordPolicy::hash('Abcdef12');
t('password verify', fn() => ok(PasswordPolicy::verify('Abcdef12', $hash)));
t('rbac admin', fn() => ok(Rbac::hasPermission('admin', 'anything')));
t('rbac pelanggan denied admin', fn() => ok(!Rbac::hasPermission('pelanggan', 'admin.delete')));
t('csrf token + validate', function () {
    SessionManager::start();
    $tok = CsrfService::token();
    ok(CsrfService::validate($tok));
    ok(!CsrfService::validate('bad'));
});
t('input validator email', fn() => ok(InputValidator::email('a@b.com') && !InputValidator::email('bad')));
t('brute force limits', function () {
    $r = BruteForceGuard::check('test-key-' . uniqid(), 2, 60);
    ok(!$r['limited']);
    $r2 = BruteForceGuard::check('test-key-' . uniqid(), 1, 60);
    // separate key, just ensure structure
    ok(isset($r2['remaining']));
});
t('incident workflow', function () {
    $id = IncidentManager::create('Test incident', 'low');
    ok(IncidentManager::transition($id, 'investigating'));
    $list = IncidentManager::list('investigating');
    ok(count($list) >= 1);
});
t('audit search', function () {
    AuditLog::record('test.action', 'success', ['foo'=>'bar']);
    $rows = AuditLog::search(['action'=>'test.action']);
    ok(count($rows) >= 1);
});
t('threat detector returns array', fn() => ok(is_array(ThreatDetector::analyze())));
t('scanner returns findings array', fn() => ok(is_array(Scanner::run(dirname(__DIR__, 2)))));
t('secret inventory redact', fn() => ok(SecretInventory::redact(['password'=>'x'])['password'] === '[REDACTED]'));

echo "\nLulus: $pass\nGagal: $fail\n";
exit($fail > 0 ? 1 : 0);
