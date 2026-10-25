// Fixture hanya di browser pengujian; tidak ditulis ke aplikasi/database.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const browser = await chromium.launch(process.env.GAMEKU_TEST_BROWSER
  ? { executablePath: process.env.GAMEKU_TEST_BROWSER }
  : {})
let gagal = 0
async function uji(nama, fn) {
  try { await fn(); console.log(`PASS ${nama}`) }
  catch (e) { gagal++; console.error(`FAIL ${nama}: ${e.message}`) }
}
const produk = [
  { id: 'qa-a', slug: 'qa-alpha', nama: 'QA Alpha', kategoriId: 'qa-k', kategoriNama: 'QA Kategori', status: 'Aktif', harga: 10000, hargaDiskon: 20000, creator: 'QA', jenis: 'Skin', preview: [] },
  { id: 'qa-b', slug: 'qa-beta', nama: 'QA Beta', kategoriId: 'qa-k', kategoriNama: 'QA Kategori', status: 'Aktif', harga: 0, hargaDiskon: 0, creator: 'QA', jenis: 'Skin', preview: [] },
]
async function halaman(path = '/store', width = 390, delay = 200) {
  const context = await browser.newContext({ viewport: { width, height: 844 } })
  await context.route('**/api/**', async (route) => {
    const pathApi = new URL(route.request().url()).pathname
    let data = null
    let status = 200
    if (pathApi === '/api/produk') { await new Promise(r => setTimeout(r, delay)); data = produk }
    else if (pathApi === '/api/kategori') data = [{ id: 'qa-k', slug: 'qa-kategori', nama: 'QA Kategori', status: 'Aktif' }]
    else if (pathApi === '/api/auth/saya') data = { admin: { id: 1, pengguna: 'qa', peran: 'admin' } }
    else if (pathApi === '/api/chat') status = 503
    else if (pathApi === '/api/pelanggan/saya') data = { pembeli: null }
    else if (pathApi.startsWith('/api/anime')) data = { items: [], totalHalaman: 1 }
    else data = []
    await route.fulfill({ status, json: { ok: status === 200, data, pesan: status === 503 ? 'AI belum dikonfigurasi' : '' } })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  page.setDefaultNavigationTimeout(20000)
  await page.goto(base + path, { waitUntil: 'domcontentloaded' })
  return { context, page, errors }
}
try {
  for (const path of ['/store', '/kategori']) {
    await uji(`katalog terlambat ${path}`, async () => {
      const { context, page, errors } = await halaman(path)
      try {
        await page.waitForSelector('.kartu-produk', { timeout: 4000 })
        assert.equal(await page.locator('.kartu-produk').count(), 2)
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    })
  }
  await uji('search URL, input, kategori slug, reset dan Back', async () => {
    const { context, page } = await halaman('/store?cari=Alpha&kategori=qa-kategori')
    try {
      await page.waitForTimeout(500)
      assert.equal(await page.locator('.kartu-produk').count(), 1)
      await page.getByRole('textbox', { name: 'Cari produk', exact: true }).fill('Beta')
      await page.waitForTimeout(100)
      assert.match(await page.locator('.nama-produk').innerText(), /Beta/)
      assert.equal(await page.getByRole('button', { name: 'QA Kategori', exact: true }).getAttribute('class'), 'pil pil-aktif')
      await page.getByRole('textbox', { name: 'Cari produk', exact: true }).fill('Tidak ada')
      await page.getByRole('link', { name: 'Reset Filter' }).click()
      await page.waitForURL(base + '/store')
      await page.waitForFunction(() => document.querySelector('.cari-besar input')?.value === '')
      assert.equal(await page.getByRole('textbox', { name: 'Cari produk', exact: true }).inputValue(), '')
      assert.equal(await page.locator('.kartu-produk').count(), 2)
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await page.waitForURL('**/store?**')
      assert.equal(await page.getByRole('textbox', { name: 'Cari produk', exact: true }).inputValue(), 'Tidak ada')
    } finally { await context.close() }
  })
  await uji('keranjang, wishlist, detail, hapus dan batas jumlah', async () => {
    const { context, page, errors } = await halaman('/store')
    try {
      await page.getByRole('button', { name: 'Tambah QA Alpha ke keranjang', exact: true }).click()
      await page.getByRole('button', { name: 'Simpan QA Alpha ke wishlist' }).click()
      await page.locator('.nama-produk').first().click()
      await page.getByRole('button', { name: 'Keranjang', exact: true }).click()
      await page.locator('.aksi-kepala a[href="/keranjang"]').click()
      assert.match(await page.locator('h1').innerText(), /2/)
      for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Tambah', exact: true }).click()
      assert.match(await page.locator('h1').innerText(), /10/)
      await page.getByRole('button', { name: 'Hapus QA Alpha' }).click()
      await page.getByRole('heading', { name: 'Keranjang masih kosong' }).waitFor()
      await page.locator('.aksi-kepala a[href="/wishlist"]').click()
      await page.waitForURL('**/wishlist')
      await page.waitForSelector('.kartu-produk')
      assert.equal(await page.locator('.kartu-produk').count(), 1)
      await page.getByRole('button', { name: 'Hapus QA Alpha dari wishlist' }).click()
      await page.getByRole('heading', { name: 'Wishlist masih kosong' }).waitFor()
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  })
  await uji('respons useApi terbaru menang', async () => {
    const { context, page } = await halaman()
    try {
      const result = await page.evaluate(async () => {
        const resource = name => performance.getEntriesByType('resource').find(e => e.name.includes('/' + name + '?')).name
        const reactModule = await import(resource('react.js'))
        const React = reactModule.default || reactModule
        const dom = await import(resource('react-dom_client.js'))
        const createRoot = dom.createRoot || dom.default.createRoot
        const { useApi } = await import('/src/layanan/gunakanApi.js')
        const pending = []; let api
        function Probe() {
          const value = useApi(() => new Promise(resolve => pending.push(resolve)), [])
          React.useEffect(() => { api = value })
          return null
        }
        const div = document.createElement('div'); document.body.append(div)
        const root = createRoot(div); root.render(React.createElement(Probe))
        const start = Date.now()
        while (!pending.length || !api) {
          if (Date.now() - start > 2000) throw new Error('Probe hook tidak terpasang')
          await new Promise(r => setTimeout(r, 10))
        }
        const newer = api.muat(); pending[1]('baru'); await newer
        pending[0]('lama'); await new Promise(r => setTimeout(r, 30))
        const result = api.data; root.unmount(); div.remove(); return result
      })
      assert.equal(result, 'baru')
    } finally { await context.close() }
  })
  await uji('galat katalog, retry, dan data kosong dibedakan', async () => {
    const { context, page } = await halaman('/keranjang')
    try {
      await context.route('**/api/produk?**', r => r.fulfill({ status: 500, json: { ok: false, pesan: 'Server gagal' } }))
      await page.locator('.navigasi-bawah a[href="/store"]').click()
      await page.getByRole('heading', { name: 'Katalog belum dapat dimuat' }).waitFor()
      await context.unroute('**/api/produk?**')
      await page.getByRole('button', { name: 'Coba lagi' }).click()
      await page.waitForSelector('.kartu-produk')
      assert.equal(await page.locator('.kartu-produk').count(), 2)
    } finally { await context.close() }
  })
  await uji('form edit gagal tidak bisa menimpa produk', async () => {
    const { context, page } = await halaman('/admin/produk')
    try {
      await context.route('**/api/produk/qa-missing', r => r.fulfill({ status: 404, json: { ok: false, pesan: 'Produk tidak ditemukan' } }))
      await page.goto(base + '/admin/produk/tambah?edit=qa-missing', { waitUntil: 'domcontentloaded' })
      await page.getByRole('alert').filter({ hasText: 'Data tidak ditemukan.' }).waitFor()
      assert.equal(await page.locator('#pr-nama').count(), 0)
    } finally { await context.close() }
  })
  await uji('preferensi panel bertahan setelah reload', async () => {
    const { context, page } = await halaman('/admin/pengaturan')
    try {
      await page.locator('#set-bio').fill('Bio QA tersimpan')
      await page.getByRole('button', { name: 'Simpan Perubahan' }).click()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('#set-bio').waitFor()
      assert.equal(await page.locator('#set-bio').inputValue(), 'Bio QA tersimpan')
    } finally { await context.close() }
  })
  await uji('pilihan episode terbaru menang atas respons lama', async () => {
    const { context, page } = await halaman('/keranjang')
    try {
      await context.route('**/api/anime/qa-seri', r => r.fulfill({ json: { ok: true, data: { seri: { judul: 'QA Seri' }, episode: [{ no: 1, judul: 'QA 1' }, { no: 2, judul: 'QA 2' }] } } }))
      await context.route('**/api/anime/qa-seri/episode/*', async r => {
        const no = r.request().url().split('/').at(-1)
        await new Promise(resolve => setTimeout(resolve, no === '1' ? 500 : 20))
        await r.fulfill({ json: { ok: true, data: { episode: { sumberPemutaran: 'hls', embedPemutaran: base + '/qa-frame-' + no } } } })
      })
      await context.route('**/qa-frame-*', r => r.fulfill({ contentType: 'text/html', body: '<p>Fixture pemutar</p>' }))
      await page.goto(base + '/streamku/qa-seri', { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Putar Episode 1' }).click()
      await page.getByRole('button', { name: 'Putar Episode 2' }).click()
      await page.waitForTimeout(650)
      assert.match(await page.locator('iframe').getAttribute('src'), /qa-frame-2$/)
    } finally { await context.close() }
  })
  await uji('pencarian admin memperbarui halaman yang sedang terbuka', async () => {
    const { context, page } = await halaman('/admin/produk', 1280)
    try {
      await page.getByRole('searchbox', { name: 'Pencarian admin' }).fill('Beta')
      await page.getByRole('searchbox', { name: 'Pencarian admin' }).press('Enter')
      await page.waitForURL('**/admin/produk?cari=Beta')
      await page.waitForFunction(() => document.querySelector('input[aria-label="Cari produk"]')?.value === 'Beta')
      assert.equal(await page.getByRole('button', { name: 'Lihat', exact: true }).count(), 1)
    } finally { await context.close() }
  })
  for (const width of [320, 1280]) {
    await uji(`modal admin, scroll dan Escape ${width}px`, async () => {
      const { context, page } = await halaman('/admin/produk', width)
      try {
        await page.getByRole('button', { name: 'Lihat', exact: true }).first().click()
        const modal = page.getByRole('dialog', { name: 'Detail Produk' })
        await modal.waitFor()
        const bounds = await modal.boundingBox()
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
        await page.keyboard.press('Escape')
        assert.equal(await modal.count(), 0)
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      } finally { await context.close() }
    })
  }
  await uji('semua halaman admin yang terdaftar bisa dirender', async () => {
    const { context, page, errors } = await halaman('/admin', 1280)
    try {
      for (const route of ['', '/produk', '/pesanan', '/pelanggan', '/creator', '/kategori', '/promo', '/ulasan', '/media', '/reseller', '/pengaturan', '/superadmin']) {
        await page.goto(base + '/admin' + route, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(250)
        assert.equal(await page.getByText('Halaman gagal ditampilkan', { exact: true }).count(), 0, route + ': ' + errors.join('; '))
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  })
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await uji(`layout ${width}px, route, chat dan console`, async () => {
      const { context, page, errors } = await halaman('/', width, 0)
      try {
        for (const path of ['/', '/store', '/kategori', '/promo', '/gratis', '/produk/qa-alpha', '/keranjang', '/wishlist', '/profil', '/bantuan', '/masuk', '/admin/login']) {
          await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(200)
          assert.equal(await page.getByText('Halaman gagal ditampilkan', { exact: true }).count(), 0, path + ': ' + errors.join('; '))
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `overflow ${path}`)
        }
        await page.goto(base + '/keranjang')
        await page.getByRole('button', { name: 'Buka Asisten Gamesku' }).click()
        const bounds = await page.locator('.cb-panel').boundingBox()
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1, 'panel chat di luar viewport')
        await page.getByRole('textbox', { name: 'Tulis pertanyaan untuk asisten' }).fill('bantuan')
        await page.getByRole('button', { name: 'Kirim pertanyaan' }).click()
        await page.getByText('Mode panduan (AI belum aktif)', { exact: true }).waitFor()
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('.cb-panel').getAttribute('aria-hidden'), 'true')
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    })
  }
} finally { await browser.close() }
console.log(`Regresi: ${gagal} gagal`)
process.exitCode = gagal ? 1 : 0
