# Uji CORS + challenge aes.js maizar.my.id (audit — baca-saja, tanpa mutasi data)
function Solve-Challenge([string]$aHex, [string]$bHex, [string]$cHex) {
    $mk = { param($h) [byte[]](0..15 | ForEach-Object { [Convert]::ToByte($h.Substring($_ * 2, 2), 16) }) }
    $a = & $mk $aHex
    $b = & $mk $bHex
    $c = & $mk $cHex
    # Coba beberapa kombinasi (key/IV bisa terbalik; padding bisa PKCS7 atau tanpa).
    $coba = @(
        @{ K = $a; I = $b; P = 'PKCS7' },
        @{ K = $b; I = $a; P = 'PKCS7' },
        @{ K = $a; I = $b; P = 'None' },
        @{ K = $b; I = $a; P = 'None' }
    )
    foreach ($uji in $coba) {
        try {
            $aes = [System.Security.Cryptography.Aes]::Create()
            $aes.Mode = 'CBC'
            $aes.Padding = $uji.P
            $aes.Key = $uji.K
            $aes.IV = $uji.I
            $pt = $aes.CreateDecryptor().TransformFinalBlock($c, 0, $c.Length)
            $hex = ($pt | ForEach-Object { $_.ToString('x2') }) -join ''
            if ($hex -match '^[0-9a-f]+$' -and $hex.Length -ge 16) { return $hex }
        } catch { }
    }
    return $null
}

$o = @()
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $r = Invoke-WebRequest -Uri 'https://maizar.my.id/api/sehat' -WebSession $s -UseBasicParsing -TimeoutSec 20
    $html = $r.Content
    if ($html -match 'toNumbers\("([0-9a-f]{32})"\),b=toNumbers\("([0-9a-f]{32})"\),c=toNumbers\("([0-9a-f]{32})"\)') {
        $val = Solve-Challenge $matches[1] $matches[2] $matches[3]
        $o += "cookie __test = $val"
        $ck = New-Object System.Net.Cookie('__test', $val, '/', 'maizar.my.id')
        $s.Cookies.Add($ck)

        # 1) GET dengan cookie + Origin gameku.store
        $r2 = Invoke-WebRequest -Uri 'https://maizar.my.id/api/sehat' -WebSession $s `
            -Headers @{ Origin = 'https://gameku.store'; Accept = 'application/json' } `
            -UseBasicParsing -TimeoutSec 20
        $o += "GET+COOKIE => $([int]$r2.StatusCode) CT=$($r2.Headers['Content-Type'])"
        $o += 'ACAO: ' + $r2.Headers['Access-Control-Allow-Origin']
        $o += 'ACAC: ' + $r2.Headers['Access-Control-Allow-Credentials']
        $o += 'BODY: ' + $r2.Content.Substring(0, [Math]::Min(300, $r2.Content.Length))

        # 2) OPTIONS preflight
        try {
            $r3 = Invoke-WebRequest -Uri 'https://maizar.my.id/api/produk' -Method Options -WebSession $s `
                -Headers @{
                    Origin                        = 'https://gameku.store'
                    'Access-Control-Request-Method' = 'GET'
                    'Access-Control-Request-Headers' = 'accept'
                } -UseBasicParsing -TimeoutSec 20
            $o += "OPTIONS => $([int]$r3.StatusCode)"
            foreach ($k in $r3.Headers.Keys) { $o += "  ${k}: $($r3.Headers[$k])" }
        } catch {
            $o += "OPTIONS GAGAL: $($_.Exception.Message)"
            if ($_.Exception.Response) {
                $o += "  STATUS $([int]$_.Exception.Response.StatusCode)"
            }
        }
    } else {
        $o += 'Tidak ada pola challenge (mungkin lolos langsung). BODY: ' + $html.Substring(0, [Math]::Min(400, $html.Length))
    }
} catch {
    $o += "GAGAL: $($_.Exception.Message)"
    if ($_.Exception.Response) { $o += "  STATUS $([int]$_.Exception.Response.StatusCode)" }
}
$o | Out-File .\_audit_cookie_test.txt -Encoding utf8
