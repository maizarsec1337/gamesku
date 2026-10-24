# Probe perilaku challenge aes.js + jangkauan SQL (audit read-only)
$o = @()
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function Ambil($u, $hdr) {
    try {
        $r = Invoke-WebRequest -Uri $u -Headers $hdr -UseBasicParsing -TimeoutSec 20
        return @{ Kode = [int]$r.StatusCode; CT = $r.Headers['Content-Type']; Body = $r.Content; H = $r.Headers }
    } catch {
        $k = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
        return @{ Kode = $k; CT = ''; Body = ''; H = @{} }
    }
}

# 1) Apakah challenge berlaku untuk aset statis (aes.js) dan path lain?
foreach ($u in @('https://maizar.my.id/aes.js', 'https://maizar.my.id/', 'https://maizar.my.id/api/sehat?i=1', 'https://maizar.my.id/api/produk?i=1')) {
    $h = @{ 'User-Agent' = $ua; 'Accept' = '*/*' }
    $r = Ambil $u $h
    $is = if ($r.Body -match 'slowAES') { 'CHALLENGE' } elseif ($r.CT -like '*json*') { 'JSON' } else { 'LAIN' }
    $o += "$u => $($r.Kode) CT=$($r.CT) [$is]"
    if ($r.Body) { $o += '    ' + ($r.Body -replace '\s+', ' ').Substring(0, [Math]::Min(160, ($r.Body -replace '\s+', ' ').Length)) }
}

# 2) Apakah query ?i=1 tanpa cookie cukup (tanpa JS)?
$r = Ambil 'https://maizar.my.id/api/sehat?i=1' @{ 'User-Agent' = $ua; 'Accept' = 'application/json' }
$o += "HASIL ?i=1 tanpa cookie => $($r.Kode) CT=$($r.CT) ACAO=[$($r.H['Access-Control-Allow-Origin'])]"

# 3) Ulangi challenge: apakah nilai cookie berubah per request (waktu-based)?
for ($i = 1; $i -le 2; $i++) {
    $r = Ambil 'https://maizar.my.id/api/sehat' @{ 'User-Agent' = $ua }
    if ($r.Body -match 'toNumbers\("([0-9a-f]{32})"\),b=toNumbers\("([0-9a-f]{32})"\),c=toNumbers\("([0-9a-f]{32})"\)') {
        $o += "challenge #$i : a=$($matches[1]) b=$($matches[2]) c=$($matches[3])"
    }
}

# 4) DNS + jangkauan TCP ke host SQL InfinityFree
try {
    $dns = Resolve-DnsName sql302.infinityfree.com -ErrorAction Stop
    $o += 'DNS sql302.infinityfree.com: ' + (($dns | Where-Object { $_.IPAddress } | ForEach-Object { $_.IPAddress }) -join ', ')
} catch {
    $o += 'DNS sql302.infinityfree.com GAGAL: ' + $_.Exception.Message
}
$t = Test-NetConnection -ComputerName sql302.infinityfree.com -Port 3306 -WarningAction SilentlyContinue
$o += "TCP sql302:3306 => $($t.TcpTestSucceeded)  (RemoteAddress=$($t.RemoteAddress))"

$o | Out-File .\_audit_probe3.txt -Encoding utf8
