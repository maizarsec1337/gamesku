# Pemeriksaan keamanan backend PHP (jalankan: pwsh backend\security-check.ps1).

param(
    [switch]$All = $false,
    [switch]$Quiet = $false,
    [string]$Output = ".\security-check-results.txt"
)

$ErrorActionPreference = "Continue"

$checks = @{
    "php_syntax"          = @{ name = "PHP Syntax";   run = { & php -l "$args[0]" 2>&1 } }
    "session_cookie"      = @{ name = "Session Cookie"; run = { param($content) $content -match "session.cookie_httponly" } }
    "cors_headers"        = @{ name = "CORS Headers"; run = { param($content) $content -match "Access-Control-Allow-Origin" } }
    "secret_files"        = @{ name = "Secret Config"; run = { param($content) $content -match "db_pass|root" } }
    "error_handling"      = @{ name = "Error Handling"; run = { param($content) $content -match "display_errors.*0|set_exception_handler" } }
    "csrf"                = @{ name = "CSRF Protection"; run = { param($content) $content -match "cekCsrf|validateCsrf" } }
    "input_validation"    = @{ name = "Input Validation"; run = { param($content) $content -match "filter_var|validateCsrf" } }
    "rate_limiting"       = @{ name = "Rate Limiting"; run = { param($content) $content -match "AuthRateLimiter" } }
    "security_headers"    = @{ name = "Security Headers"; run = { param($content) $content -match "X-Content-Type-Options|X-Frame-Options" } }
    "db_prepared"         = @{ name = "DB Prepared Statements"; run = { param($content) $content -match "PDO|prepare" } }
}

$results = @{
    pass = @();
    fail = @();
    warn = @();
}

# Scan file PHP backend
$base = ".\backend"
$phpFiles = @(
    "$base\src\Auth.php",
    "$base\src\Database.php",
    "$base\src\Bantu.php",
    "$base\src\bootstrap.php",
    "$base\src\Aktivitas.php",
    "$base\api\index.php",
    "$base\database\instal.php"
)

# --- 1. PHP Syntax Check ---
Write-Host "== PHP Syntax Check ==" -ForegroundColor Cyan
$phpFiles | ForEach-Object {
    $file = $_
    if (Test-Path $file) {
        $output = & php -l $file 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [PASS] $(Split-Path $file -Leaf)" -ForegroundColor Green
            $results.pass += "PHP Syntax: $(Split-Path $file -Leaf)"
        } else {
            Write-Host "  [FAIL] $(Split-Path $file -Leaf): $output" -ForegroundColor Red
            $results.fail += "PHP Syntax: $(Split-Path $file -Leaf)"
        }
    }
}

# --- 2. Security Code Check ---
Write-Host "`n== Security Code Check ==" -ForegroundColor Cyan

$filesToCheck = @(
    "$base\src\Auth.php",
    "$base\src\bootstrap.php",
    "$base\src\Bantu.php",
    "$base\src\Database.php",
    "$base\src\Pengendali\PengendaliAuth.php",
    "$base\src\Pengendali\PengendaliDasar.php"
)

$filesToCheck | ForEach-Object {
    $file = $_
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        foreach ($check in $checks.GetEnumerator()) {
            $passed = & $check.Value.run $content
            if ($passed) {
                Write-Host "  [PASS] $check.Value.name ($file)" -ForegroundColor Green
                $results.pass += "$check.Value.name: $file"
            } else {
                Write-Host "  [WARN] $check.Value.name ($file)" -ForegroundColor Yellow
                $results.warn += "$check.Value.name: $file"
            }
        }
    }
}

# --- 3. Summary ---
Write-Host "`n== Summary ==" -ForegroundColor Cyan
Write-Host "  Passes: $(($results.pass | Measure-Object).Count)" -ForegroundColor Green
Write-Host "  Fails:  $(($results.fail | Measure-Object).Count)" -ForegroundColor Red
Write-Host "  Warns:  $(($results.warn | Measure-Object).Count)" -ForegroundColor Yellow

if ($results.fail.Count -gt 0) {
    Write-Host "`n  ❌ Fix needed before deploy." -ForegroundColor Red
} elseif ($results.warn.Count -gt 0) {
    Write-Host "`n  ⚠️  Review warnings before deploy." -ForegroundColor Yellow
} else {
    Write-Host "`n  ✅ Security checks passed!" -ForegroundColor Green
}

# Optional output to file
if ($Output -and -not $Quiet) {
    $results | ConvertTo-Json | Out-File $Output
    Write-Host "`n  Results saved to $Output" -ForegroundColor Gray
}

exit ($results.fail.Count -gt 0 ? 1 : 0)
