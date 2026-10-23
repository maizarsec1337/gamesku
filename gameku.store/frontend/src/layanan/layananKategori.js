// Layanan kategori TOKO DEPAN — membaca kategori NYATA dari backend (GET /api/kategori).
// Tamu hanya menerima kategori Aktif (backend yang menyaring).

const API = '/api'

let cache = []
let versi = 0
let sudahDimuat = false
let sedangMemuat = false
let galatTerakhir = null
const pendengar = new Set()

function siarkan() {
  for (const dengar of pendengar) dengar()
}

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

async function muatKategori() {
  if (sedangMemuat) return
  sedangMemuat = true
  try {
    const respons = await fetch(`${API}/kategori`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    const isi = await respons.json().catch(() => null)
    if (!respons.ok || !isi || isi.ok !== true || !Array.isArray(isi.data)) {
      throw new Error((isi && isi.pesan) || `Gagal memuat kategori (HTTP ${respons.status}).`)
    }
    cache = isi.data
    galatTerakhir = null
  } catch (e) {
    galatTerakhir = e
  } finally {
    sudahDimuat = true
    sedangMemuat = false
    versi += 1
    siarkan()
  }
}

export function subscribeKategori(dengar) {
  pendengar.add(dengar)
  if (!sudahDimuat && !sedangMemuat) muatKategori()
  return () => pendengar.delete(dengar)
}

export function muatUlangKategori() {
  sudahDimuat = false
  return muatKategori()
}

export function galatKategori() {
  return galatTerakhir
}

export const daftarKategori = memoVersi(() => cache)

export const ambilKategoriId = memoVersi((id) => cache.find((k) => k.id === id) || null)

export const ambilKategoriSlug = memoVersi((slug) => cache.find((k) => k.slug === slug) || null)

export const kategoriAktif = memoVersi(() => cache.filter((k) => k.status === 'Aktif'))

export function namaKategori(id) {
  const k = cache.find((x) => x.id === id)
  return k ? k.nama : ''
}

export const kosongkan = () => ({
  nama: '',
  slug: '',
  deskripsi: '',
  ikon: 'kategori',
  gambar: '',
  status: 'Aktif',
})

export default {
  daftar: daftarKategori,
  ambil: ambilKategoriId,
  ambilSlug: ambilKategoriSlug,
  aktif: kategoriAktif,
  namaKategori,
  subscribe: subscribeKategori,
  subscribeKategori,
  muatUlang: muatUlangKategori,
  kosongkan,
}
