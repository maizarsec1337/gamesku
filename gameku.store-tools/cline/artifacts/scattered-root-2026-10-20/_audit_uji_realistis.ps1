# Uji: apakah fetch browser-realistis lolos challenge aes.js (audit read-only)
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$hdr = @{
    'User-Agent'         = $ua
    'Accept'             = 'application/json'
    'Accept-Language'    = 'id-ID,id;q=0.9,en;q=0.8'
    'Origin'             = 'https://gameku.store'
    'Referer'            = 'https://gameku.store/'
    'sec-ch-ua'          = '"Chromium";v="126", "Not.A/Brand";v="24"'
    'sec-ch-ua-mobile'   = '?0'
    'sec-ch-ua-platform' = '"Windows"'
    'Sec-Fetch-Mode'     = 'cors'
    'Sec-Fetch-Site'     = 'cross-site'
    'Sec-Fetch-Dest'     = 'empty'
}
$o = @()
foreach ($u in @('https://maizar.my.id/api/sehat', 'https://maizar.my.id/api/produk')) {
    try {
        $r = Invoke-WebRequest -Uri $u -Headers $hdr -UseBasicParsing -TimeoutSec 20
        $ct = $r.Headers['Content-Type']
        $o += "GET $u => $([int]$r.StatusCode) CT=$ct"
        $o += '  ACAO: [' + $r.Headers['Access-Control-Allow-Origin'] + ']'
        $o += '  ACAM: [' + $r.Headers['Access-Control-Allow-Methods'] + ']'
        $o += '  ACAC: [' + $r.Headers['Access-Control-Allow-Credentials'] + ']'
        $o += '  BODY: ' + $r.Content.Substring(0, [Math]::Min(300, $r.Content.Length))
    } catch {
        $s = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR: ' + $_.Exception.Message }
        $o += "GET $u => $s"
    }
}
try {
    $p = @{
        'Origin'                         = 'https://gameku.store'
        'Access-Control-Request-Method'  = 'GET'
        'Access-Control-Request-Headers' = 'accept'
        'Sec-Fetch-Mode'                 = 'cors'
        'Sec-Fetch-Site'                 = 'cross-site'
        'Sec-Fetch-Dest'                 = 'empty'
        'User-Agent'                     = $ua
    }
    $r3 = Invoke-WebRequest -Uri 'https://maizar.my.id/api/produk' -Method Options -Headers $p -UseBasicParsing -TimeoutSec 20
    $o += "OPTIONS => $([int]$r3.StatusCode)"
    $o += '  ACAO: [' + $r3.Headers['Access-Control-Allow-Origin'] + ']'
    $o += '  ACAM: [' + $r3.Headers['Access-Control-Allow-Methods'] + ']'
    $o += '  ACAH: [' + $r3.Headers['Access-Control-Allow-Headers'] + ']'
    $o += '  ACAC: [' + $r3.Headers['Access-Control-Allow-Credentials'] + ']'
} catch {
    $o += 'OPTIONS GAGAL: ' + $_.Exception.Message
    if ($_.Exception.Response) { $o += '  STATUS ' + [int]$_.Exception.Response.StatusCode }
}
$o | Out-File .\_audit_realistis.txt -Encoding utf8
