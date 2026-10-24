// Audit: selesaikan challenge AES InfinityFree lalu uji API/CORS sungguhan.
import crypto from 'node:crypto'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const ASAL = 'https://gameku.store'
const HOST = 'https://maizar.my.id'

function aesCbcDecrypt(hexKey, hexIv, hexCt) {
  const key = Buffer.from(hexKey, 'hex')
  const iv = Buffer.from(hexIv, 'hex')
  const ct = Buffer.from(hexCt, 'hex')
  const d = crypto.createDecipheriv('aes-128-cbc', key, iv)
  d.setAutoPadding(false)
  let pt = Buffer.concat([d.update(ct), d.final()])
  // Buang padding PKCS7 bila valid.
  const pad = pt[pt.length - 1]
  if (pad >= 1 && pad <= 16 && pt.subarray(-pad).every((b) => b === pad)) pt = pt.subarray(0, -pad)
  return pt.toString('hex')
}

async function ambil(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9', ...headers }, redirect: 'manual' })
  const ct = r.headers.get('content-type') || ''
  const body = ct.includes('json') ? await r.json() : await r.text()
  return { status: r.status, ct, body, headers: r.headers }
}

function pola(html) {
  const m = html.match(/toNumbers\("([0-9a-f]{32})"\),b=toNumbers\("([0-9a-f]{32})"\),c=toNumbers\("([0-9a-f]{32})"\)/)
  return m ? { a: m[1], b: m[2], c: m[3] } : null
}

const out = []
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s) }

// 1) Ambil challenge
const r1 = await ambil(`${HOST}/api/sehat`)
log(`[1] GET /api/sehat tanpa cookie => ${r1.status} CT=${r1.ct}`)
const p = typeof r1.body === 'string' ? pola(r1.body) : null
if (!p) {
  log('    Tidak ada challenge. BODY:', JSON.stringify(r1.body).slice(0, 400))
} else {
  log(`    challenge a=${p.a} b=${p.b} c=${p.c}`)
  // 2) Coba semua kombinasi key/iv/padding
  let val = null
  for (const [k, iv] of [[p.a, p.b], [p.b, p.a]]) {
    try { val = aesCbcDecrypt(k, iv, p.c); break } catch {}
  }
  log(`    __test = ${val}`)
  if (!val) { log('    GAGAL decrypt'); }

  // 3) Uji dengan cookie pada beberapa varian
  for (const u of [`${HOST}/api/sehat`, `${HOST}/api/sehat?i=1`, `${HOST}/api/produk`]) {
    const r = await ambil(u, { Cookie: `__test=${val}`, Origin: ASAL, Referer: `${ASAL}/` })
    log(`[2] ${u} +cookie => ${r.status} CT=${r.ct}`)
    log(`    ACAO=${r.headers.get('access-control-allow-origin')} ACAC=${r.headers.get('access-control-allow-credentials')} ACAM=${r.headers.get('access-control-allow-methods')}`)
    log(`    BODY=${JSON.stringify(r.body).slice(0, 300)}`)
  }

  // 4) Preflight OPTIONS (browser TIDAK mengirim cookie saat preflight)
  for (const withCookie of [false, true]) {
    const h = {
      Origin: ASAL,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'accept',
    }
    if (withCookie) h.Cookie = `__test=${val}`
    const r = await fetch(`${HOST}/api/produk`, { method: 'OPTIONS', headers: { 'User-Agent': UA, ...h } })
    log(`[3] OPTIONS (cookie=${withCookie}) => ${r.status} CT=${r.headers.get('content-type')}`)
    log(`    ACAO=${r.headers.get('access-control-allow-origin')} ACAM=${r.headers.get('access-control-allow-methods')} ACAH=${r.headers.get('access-control-allow-headers')}`)
    const t = await r.text()
    log(`    BODY=${t.slice(0, 200)}`)
  }
}

await import('node:fs').then((fs) => fs.writeFileSync('./_audit_solve_out.txt', out.join('\n'), 'utf8'))
