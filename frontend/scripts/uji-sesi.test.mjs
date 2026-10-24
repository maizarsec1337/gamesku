import assert from 'node:assert/strict'
import { test } from 'node:test'
import { masukPembeli, keluarPembeli } from '../src/layanan/layananSesiPembeli.js'
import { masukAdmin, keluarAdmin } from '../src/layanan/apiAdmin.js'
import { kirimReseller } from '../src/layanan/layananReseller.js'

test('token aktif dipakai setelah login, pergantian akun, dan rotasi sesi di tab lain', async () => {
  let token = 'awal'
  const asli = globalThis.fetch
  globalThis.fetch = async (url, opsi = {}) => {
    if (url === '/api/auth/csrf-token') {
      return Response.json({ ok: true, data: { csrf_token: token } })
    }
    assert.equal(opsi.credentials, 'same-origin')
    assert.equal(opsi.headers['X-CSRF-Token'], token, 'request memakai token sesi lama')
    if (url.endsWith('/masuk') || url === '/api/auth/keluar') token += '-rotasi'
    return Response.json({ ok: true, data: { id: 'qa' } })
  }
  try {
    await masukPembeli('qa@example.test', 'fixture-sandi')
    await keluarPembeli()
    await masukPembeli('qa@example.test', 'fixture-sandi')
    await kirimReseller('628123456789')
    await masukAdmin('qa', 'fixture-sandi')
    await kirimReseller('628123456789')
    token = 'rotasi-tab-lain'
    await kirimReseller('628123456789')
    await keluarAdmin()
  } finally {
    globalThis.fetch = asli
  }
})
