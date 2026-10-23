// Fixture HTTP hanya di konteks browser pengujian; tidak mengubah DB pengguna.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const executablePath = [process.env.GAMEKU_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && existsSync(p))
const browser = await chromium.launch({ executablePath })
let gagal = 0
async function uji(nama, fn) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const errors = []
  const state = { admin: null, pembeli: null, token: 'awal', ajuan: null, galatKirim: false, galatKeluar: false }
  await context.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    let data = [], status = 200, pesan = ''
    if (path === '/api/auth/csrf-token') data = { csrf_token: state.token }
    else if (req.method() !== 'GET' && req.headers()['x-csrf-token'] !== state.token) {
      status = 403; pesan = 'Token keamanan tidak valid.'
    } else if (path === '/api/auth/saya') data = { admin: state.admin }
    else if (path === '/api/auth/keluar') {
      if (state.galatKeluar) { status = 503; pesan = 'Logout admin gagal. Coba lagi.' }
      else state.admin = null
    }
    else if (path === '/api/pelanggan/saya') data = { pembeli: state.pembeli }
    else if (path === '/api/pelanggan/masuk') {
      state.pembeli = { id: 'qa', nama: 'Pembeli QA', email: 'qa@example.test' }
      state.token += '-login'
      data = state.pembeli
    } else if (path === '/api/pelanggan/keluar') {
      if (state.galatKeluar) { status = 503; pesan = 'Logout gagal. Coba lagi.' }
      else state.pembeli = null
    } else if (path === '/api/reseller/saya') data = state.ajuan
    else if (path === '/api/reseller' && req.method() === 'POST') {
      if (state.galatKirim) { status = 422; pesan = 'Nomor WhatsApp tidak valid.' }
      else { state.ajuan = { id: 'qa-ajuan', status: 'pending' }; data = state.ajuan }
    } else if (path.endsWith('/batal')) { status = 409; pesan = 'Pengajuan sudah diproses.' }
    await route.fulfill({ status, json: { ok: status < 400, data, pesan } })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', e => errors.push(e.message))
  try {
    await fn(page, state)
    assert.deepEqual(errors, [])
    console.log('PASS ' + nama)
  } catch (err) { gagal++; console.error('FAIL ' + nama + ': ' + err.message) }
  finally { await context.close() }
}
async function login(page, path = '/masuk') {
  await page.goto(base + path)
  await page.locator('input[type=email]').fill('qa@example.test')
  await page.locator('input[type=password]').fill('fixture-sandi')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.getByText('Pembeli QA', { exact: true }).waitFor()
}
try {
  for (const path of ['/masuk', '/profil']) {
    await uji(`login dari ${path}, profil, logout gagal dan retry`, async (page, state) => {
      await login(page, path)
      await page.getByText('qa@example.test', { exact: true }).waitFor()
      assert.equal(await page.getByText('Belum masuk', { exact: true }).count(), 0)
      state.galatKeluar = true
      await page.getByRole('button', { name: 'Keluar', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'Logout gagal' }).waitFor()
      await page.getByText('Pembeli QA', { exact: true }).waitFor()
      state.galatKeluar = false
      await page.getByRole('button', { name: 'Keluar', exact: true }).click()
      await page.locator('input[type=password]').waitFor()
      assert.equal(state.pembeli, null)
    })
  }
  await uji('pengajuan ditolak bisa diajukan ulang; kegagalan tampil; retry sukses', async (page, state) => {
    await login(page)
    state.ajuan = { id: 'qa-ajuan-lama', status: 'rejected', alasan_penolakan: 'Lengkapi kontak' }
    await page.getByText('Daftar Reseller', { exact: true }).click()
    await page.getByRole('button', { name: 'Ajukan kembali' }).click()
    await page.locator('#reseller-whatsapp').fill('628123456789')
    await page.locator('#syarat-reseller').check()
    state.galatKirim = true
    await page.getByRole('button', { name: 'Kirim Pengajuan' }).click()
    await page.getByRole('alert').filter({ hasText: 'Nomor WhatsApp tidak valid.' }).waitFor()
    state.galatKirim = false
    state.token = 'rotasi-tab-lain'
    await page.getByRole('button', { name: 'Kirim Pengajuan' }).click()
    await page.getByText('Pengajuan Anda sedang ditinjau.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Batalkan', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Pengajuan sudah diproses.' }).waitFor()
  })
  await uji('jumlah keranjang baru dan perubahan selalu bilangan bulat 1 sampai 10', async page => {
    await page.goto(base + '/keranjang')
    const hasil = await page.evaluate(async () => {
      const resource = name => performance.getEntriesByType('resource').find(e => e.name.includes('/' + name + '?')).name
      const reactModule = await import(resource('react.js'))
      const React = reactModule.default || reactModule
      const dom = await import(resource('react-dom_client.js'))
      const createRoot = dom.createRoot || dom.default.createRoot
      const { PenyediaKeranjang } = await import('/src/konteks/KonteksKeranjang.jsx')
      const { useKeranjang } = await import('/src/konteks/konteksKeranjang.js')
      let keranjang
      function Probe() {
        const nilai = useKeranjang()
        React.useEffect(() => { keranjang = nilai })
        return null
      }
      const div = document.createElement('div'); document.body.append(div)
      const root = createRoot(div)
      const hasil = []
      const tunggu = async cek => {
        const mulai = Date.now()
        while (!cek()) {
          if (Date.now() - mulai > 2000) throw new Error('Keranjang tidak diperbarui')
          await new Promise(r => setTimeout(r, 10))
        }
      }
      try {
        root.render(React.createElement(PenyediaKeranjang, null, React.createElement(Probe)))
        await tunggu(() => keranjang)
        for (const [jumlah, harapan] of [[99, 10], [-4, 1], [2.6, 3], [Infinity, 1], [NaN, 1], ['4', 4]]) {
          keranjang.tambahItem({ id: 'qa', nama: 'QA', harga: 100, jumlah })
          await tunggu(() => keranjang.daftarItem.length === 1)
          hasil.push(keranjang.daftarItem[0].jumlah)
          keranjang.ubahJumlah('qa', 99)
          await tunggu(() => keranjang.daftarItem[0].jumlah === 10)
          keranjang.ubahJumlah('qa', jumlah)
          await tunggu(() => keranjang.daftarItem[0].jumlah === harapan)
          hasil.push(keranjang.daftarItem[0].jumlah)
          keranjang.kosongkanKeranjang()
          await tunggu(() => !keranjang.daftarItem.length)
        }
      } finally { root.unmount(); div.remove() }
      return hasil
    })
    assert.deepEqual(hasil, [10, 10, 1, 1, 3, 3, 1, 1, 1, 1, 4, 4])
  })
  for (const menu of ['sidebar', 'header']) {
    await uji(`logout admin melalui ${menu}: galat ditampilkan dan retry berhasil`, async (page, state) => {
      state.admin = { id: 1, nama: 'Admin QA', pengguna: 'qa', peran: 'admin' }
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(base + '/admin/produk')
      const klikKeluar = async () => {
        if (menu === 'sidebar') await page.getByRole('button', { name: 'Keluar dari sesi admin' }).click()
        else {
          await page.locator('.kepala-profil').click()
          await page.getByRole('button', { name: 'Keluar', exact: true }).click()
        }
      }
      state.galatKeluar = true
      await klikKeluar()
      await page.locator('.toast-admin').filter({ hasText: 'Logout admin gagal' }).waitFor()
      assert.ok(page.url().endsWith('/admin/produk'))
      assert.ok(state.admin)
      state.galatKeluar = false
      await klikKeluar()
      await page.waitForURL('**/admin/login')
      assert.equal(state.admin, null)
    })
  }
} finally { await browser.close() }
console.log(`Alur pembeli: ${gagal} gagal`)
process.exitCode = gagal ? 1 : 0
