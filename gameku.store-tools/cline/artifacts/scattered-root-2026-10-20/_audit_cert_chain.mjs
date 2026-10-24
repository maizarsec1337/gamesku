// Uji chain: leaf(maizar.my.id) -> int-yr2 -> root-yr-by-x1 -> ISRG Root X1
import tls from 'node:tls'

const FILES = [
  'https://letsencrypt.org/certs/gen-y/int-yr2.pem',
  'https://letsencrypt.org/certs/gen-y/root-yr-by-x1.pem',
  'https://letsencrypt.org/certs/isrgrootx1.pem',
]

const caList = []
for (const u of FILES) {
  try {
    const r = await fetch(u)
    if (!r.ok) { console.log('gagal', u, r.status); continue }
    const pem = await r.text()
    caList.push(pem)
    console.log('ok', u, pem.length)
  } catch (e) { console.log('ERR', u, e.message) }
}

const sock = tls.connect({
  host: 'maizar.my.id', port: 443, servername: 'maizar.my.id', ca: caList,
}, () => {
  console.log('AUTHORIZED:', sock.authorized, '| error:', sock.authorizationError)
  sock.end()
})
sock.on('error', (e) => console.log('ERR', e.message))
