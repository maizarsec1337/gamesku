// Layanan produk TOKO DEPAN — membaca katalog NYATA dari backend (GET /api/produk).
// Tidak ada data contoh: katalog kosong bila server belum punya produk.
//
// Model: cache dalam memori + langganan (agar useSyncExternalStore aman).
// Getter mengembalikan referensi STABIL selama cache tidak berubah.

const API = '/api'

let cache = []
let versi = 0
let sudahDimuat = false
let sedangMemuat = false
let galatTerakhir = null
const pendengar = new Set()
let status = { memuat: true, galat: null }
export const statusProduk = () => status

function siarkan() {
  for (const dengar of pendengar) dengar()
}

// Memo bergantung versi: referensi stabil sampai cache berubah.
function memoVersi(hitung) {
  const simpan = new Map()
  return (...args) => {
    const kunci = args.length ? JSON.stringify(args) : ''
    const ada = simpan.get(kunci)
    if (ada && ada.v === versi) return ada.nilai
    const nilai = hitung(...args)
    simpan.set(kunci, { v: versi, nilai })
    return nilai
  }
}

async function muatKatalog() {
  if (sedangMemuat) return
  sedangMemuat = true
  status = { memuat: true, galat: null }
  siarkan()
  try {
    const respons = await fetch(`${API}/produk?batas=200`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    const isi = await respons.json().catch(() => null)
    if (!respons.ok || !isi || isi.ok !== true || !Array.isArray(isi.data)) {
      throw new Error((isi && isi.pesan) || `Gagal memuat produk (HTTP ${respons.status}).`)
    }
    cache = isi.data
    galatTerakhir = null
  } catch (e) {
    galatTerakhir = e
  } finally {
    sudahDimuat = true
    sedangMemuat = false
    status = { memuat: false, galat: galatTerakhir }
    versi += 1
    siarkan()
  }
}

// Berlangganan perubahan katalog; memicu pemuatan pertama dari server.
export function subscribeProduk(dengar) {
  pendengar.add(dengar)
  if (!sudahDimuat && !sedangMemuat) muatKatalog()
  return () => pendengar.delete(dengar)
}

// Muat ulang manual (mis. setelah admin mengubah katalog).
export function muatUlangProduk() {
  sudahDimuat = false
  return muatKatalog()
}

export function galatProduk() {
  return galatTerakhir
}

// ---------- Getter (referensi stabil) ----------

export const daftarProduk = memoVersi(() => cache)

export const produkTersedia = memoVersi(() => cache.filter((p) => p.status === 'Aktif'))

export const produkGratis = memoVersi((jumlah) => {
  const semua = cache.filter((p) => p.status === 'Aktif' && Number(p.harga) === 0)
  return jumlah ? semua.slice(0, jumlah) : semua
})

export const produkTerbaru = memoVersi((jumlah = 8) =>
  [...cache.filter((p) => p.status === 'Aktif')]
    .sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
    .slice(0, jumlah),
)

export const ambilProdukId = memoVersi((id) => cache.find((p) => p.id === id) || null)

export const ambilProdukSlug = memoVersi((slug) => cache.find((p) => p.slug === slug) || null)

// Pencarian pada nama, creator, dan slug (hanya produk Aktif).
export function cariProduk(kataKunci, katalog = cache) {
  const kunci = String(kataKunci || '').trim().toLowerCase()
  const tersedia = katalog.filter((p) => p.status === 'Aktif')
  if (!kunci) return tersedia
  return tersedia.filter((p) =>
    `${p.nama} ${p.creator} ${p.slug}`.toLowerCase().includes(kunci),
  )
}

export function urutkanProduk(daftar, mode = 'terbaru') {
  const salin = [...daftar]
  if (mode === 'harga-rendah') salin.sort((a, b) => a.harga - b.harga)
  else if (mode === 'harga-tinggi') salin.sort((a, b) => b.harga - a.harga)
  else if (mode === 'nama') salin.sort((a, b) => a.nama.localeCompare(b.nama))
  else salin.sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
  return salin
}

export function produkTerkait(produk, jumlah = 4) {
  if (!produk) return []
  return cache
    .filter((p) => p.status === 'Aktif' && p.id !== produk.id)
    .sort(
      (a, b) =>
        Number(b.kategoriId === produk.kategoriId) - Number(a.kategoriId === produk.kategoriId),
    )
    .slice(0, jumlah)
}

export function jumlahProdukPerKategori(kategoriId) {
  return cache.filter((p) => p.kategoriId === kategoriId).length
}

export default {
  daftar: daftarProduk,
  ambil: ambilProdukId,
  ambilSlug: ambilProdukSlug,
  subscribe: subscribeProduk,
  subscribeProduk,
  tersedia: produkTersedia,
  gratis: produkGratis,
  terbaru: produkTerbaru,
  cari: cariProduk,
  urutkan: urutkanProduk,
  terkait: produkTerkait,
  jumlahPerKategori: jumlahProdukPerKategori,
  muatUlang: muatUlangProduk,
}
