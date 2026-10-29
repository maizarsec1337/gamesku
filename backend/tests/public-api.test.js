import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { redactSecrets, runSecurityScan } from '../src/security.js'

test('anime public endpoints preserve catalog, search, detail, and missing-slug contracts', async (t) => {
  process.env.NODE_ENV = 'test'
  const { app } = await import('../src/server.js')
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`

  const catalogResponse = await fetch(`${base}/api/anime?per=2`)
  assert.equal(catalogResponse.status, 200)
  const catalog = await catalogResponse.json()
  assert.equal(catalog.ok, true)
  assert.equal(catalog.data.items.length, 2)
  assert.ok(catalog.data.total > 0)
  const slug = catalog.data.items[0].slug
  assert.ok(slug)

  const detailResponse = await fetch(`${base}/api/anime/${encodeURIComponent(slug)}`)
  assert.equal(detailResponse.status, 200)
  const detail = await detailResponse.json()
  assert.equal(detail.data.seri.slug, slug)
  assert.ok(Array.isArray(detail.data.episode))

  const missingResponse = await fetch(`${base}/api/anime/__missing_gameku_series__`)
  assert.equal(missingResponse.status, 404)
  assert.equal((await missingResponse.json()).ok, false)

  const anonymousConversation = await fetch(`${base}/api/pesan/percakapan`)
  assert.equal(anonymousConversation.status, 401)
  const missingCsrf = await fetch(`${base}/api/pelanggan/keluar`, { method: 'POST' })
  assert.equal(missingCsrf.status, 403)
  const deniedOrigin = await fetch(`${base}/api/anime?per=1`, { headers: { Origin: 'https://attacker.example' } })
  assert.equal(deniedOrigin.status, 403)
  assert.equal(deniedOrigin.headers.get('x-content-type-options'), 'nosniff')
})

test('security helpers redact secrets and never read environment file values', async (t) => {
  assert.deepEqual(redactSecrets({ password: 'do-not-store', nested: { apiKey: 'private', safe: 'kept' } }), { password: '[REDACTED]', nested: { apiKey: '[REDACTED]', safe: 'kept' } })
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameku-security-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'))
  await writeFile(path.join(root, '.env'), 'PASSWORD=private-environment-value')
  await writeFile(path.join(root, 'src', 'config.js'), "const apiKey = 'hardcoded-private-value'\n")
  const scan = runSecurityScan(root)
  assert.equal(scan.filesChecked, 1)
  assert.equal(scan.findings.some((finding) => finding.component === '.env'), true)
  assert.equal(scan.findings.some((finding) => finding.category === 'secrets' && finding.component === 'src/config.js'), true)
  assert.equal(JSON.stringify(scan).includes('private-environment-value'), false)
  assert.equal(JSON.stringify(scan).includes('hardcoded-private-value'), false)
})
