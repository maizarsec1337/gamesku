# Penentu: (1) header Set-Cookie pada respons challenge, (2) apakah path non-PHP/berkas statis lolos.
$ErrorActionPreference = 'Continue'
$o = @()

function Tampil($label, $u, $hdr) {
    try {
        $r = Invoke-WebRequest -Uri $u -Headers $hdr -UseBasicParsing -TimeoutSec 20
        $c = $r.Content
        if ($c -is [byte[]]) { $c = [System.Text.Encoding]::UTF8.GetString($c) }
        $is = if ($c -match 'toNumbers\(') { 'CHALLENGE' } else { 'PASS' }
        $sc = $r.Headers['Set-Cookie']
        $script:o += "[$label] $([int]$r.StatusCode) CT=$($r.Headers['Content-Type']) $is"
        $script:o += "    Set-Cookie: $(if ($sc) { ($sc -join ' || ') } else { '(none)' })"
    } catch {
        $script:o += "[$label] ERR $($_.Exception.Message)"
    }
}

$hdr = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36' }
Tampil 'api/sehat'      'https://maizar.my.id/api/sehat'      $hdr
Tampil 'root'          'https://maizar.my.id/'              $hdr
Tampil 'aes.js'        'https://maizar.my.id/aes.js'        $hdr
Tampil 'favicon.ico'   'https://maizar.my.id/favicon.ico'   $hdr
Tampil 'robots.txt'    'https://maizar.my.id/robots.txt'    $hdr

$o | Out-File .\_audit_chal_detail.txt -Encoding utf8
