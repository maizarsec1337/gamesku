# Audit embed resmi: cek headers + isi halaman pemutar partner sumber.
import re
import json
import urllib.request

EMBED = 'https://vid.animehi.co/watch?id=343'

req = urllib.request.Request(EMBED, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GameKU-audit/1.0',
    'Referer': 'https://otakudesu.com.mx/',
})
try:
    resp = urllib.request.urlopen(req, timeout=25)
    html = resp.read().decode('utf-8', 'replace')
    print('STATUS:', resp.status)
    print('URL AKHIR:', resp.geturl())
    print('--- HEADER ---')
    for k, v in resp.headers.items():
        print(f'{k}: {v}')
except Exception as e:
    print('GAGAL:', type(e).__name__, e)
    raise SystemExit(1)

print('panjang:', len(html))
with open('audit_embed.html', 'w', encoding='utf-8') as f:
    f.write(html)

for name, pat in [
    ('IFRAME', r'<iframe[^>]*?src=["\']([^"\']+)["\']'),
    ('SOURCE', r'<source[^>]*?src=["\']([^"\']+)["\']'),
    ('M3U8', r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*'),
    ('MP4', r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*'),
    ('PLAYERJS', r'data-file=["\']([^"\']+)'),
    ('HLSVAR', r'(?:source|src|file)\s*[:=]\s*["\']([^"\']+)["\']'),
]:
    m = re.findall(pat, html, re.I)
    print(name, '->', json.dumps(sorted(set(m))[:15], indent=1))
