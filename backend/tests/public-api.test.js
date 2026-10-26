import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app } from '../src/server.js'

test('anime public endpoints preserve catalog, search, detail, and missing-slug contracts', async (t) => {
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
})
