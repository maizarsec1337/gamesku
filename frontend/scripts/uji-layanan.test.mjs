import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { tulis } from '../src/layanan/penyimpananLokal.js'
import { daftarPesanan, tambahPesanan, ubahStatusPesanan, subscribePesanan, pesananBerhasil, hitungPerStatus } from '../src/layanan/layananPesanan.js'

// Penyimpanan terisolasi proses test, tidak menyentuh browser pengguna.
const storage = new Map()
globalThis.window = { localStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
} }
beforeEach(() => tulis('pesanan', []))

test('snapshot pesanan stabil sampai ada perubahan', () => {
  assert.deepEqual(daftarPesanan(), [])
  assert.equal(daftarPesanan(), daftarPesanan())
})
test('listener langsung membaca snapshot baru dan bisa berhenti', () => {
  let calls = 0
  const stop = subscribePesanan(() => { calls++; assert.equal(daftarPesanan().length, 1) })
  const result = tambahPesanan({ pelanggan: 'QA', produk: 'Fixture test', total: 100 })
  assert.equal(result.berhasil, true)
  assert.equal(calls, 1)
  stop()
  ubahStatusPesanan(result.data.id, 'Berhasil')
  assert.equal(calls, 1)
  assert.equal(pesananBerhasil().length, 1)
  assert.equal(hitungPerStatus().Berhasil, 1)
})
test('status tidak dikenal dan ID yang tidak ada ditolak', () => {
  assert.equal(ubahStatusPesanan('hilang', 'INVALID').berhasil, false)
  assert.equal(ubahStatusPesanan('hilang', 'Berhasil').berhasil, false)
  assert.deepEqual(daftarPesanan(), [])
})
