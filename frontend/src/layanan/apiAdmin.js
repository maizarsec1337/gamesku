// Klien API admin GameKU — memakai backend Express di /api.
// Tidak ada data contoh: setiap pembacaan/penulisan mengambil server nyata.
//
// - Sesi server memakai cookie HttpOnly (credentials: 'include').
// - Request state-changing (POST/PUT/PATCH/DELETE) menyertakan token CSRF
//   dari GET /api/auth/csrf-token.
// - Token CSRF dibaca dari sesi aktif sebelum setiap perubahan.

import { URL_API } from './urlApi.js'

const API = URL_API

export class GalatApi extends Error {
  constructor(pesan, status, data) {
    super(pesan)
    this.nama = 'GalatApi'
    this.status = status
    this.data = data
  }
}

// Permintaan dasar; melempar GalatApi bila gagal (jaringan / respons non-ok).
async function minta(jalur, opsi = {}) {
  let respons
  try {
    respons = await fetch(`${API}${jalur}`, {
      ...opsi,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(opsi.headers || {}) },
    })
  } catch {
    throw new GalatApi('Tidak dapat menghubungi server. Periksa koneksi Anda.', 0)
  }

  // 502/503/504 dari proxy Vite = backend Express (port 8000) tidak aktif / tidak
  // dapat dihubungi. Beri pesan yang jelas & aman (bukan detail internal).
  if (respons.status === 502 || respons.status === 503 || respons.status === 504) {
    let pesanBackend = ''
    try {
      const j = await respons.json()
      pesanBackend = (j && typeof j.pesan === 'string' && j.pesan) || ''
    } catch {
      // proxy mengembalikan laman non-JSON saat target mati — abaikan.
    }
    throw new GalatApi(
      pesanBackend ||
        `Backend API tidak aktif (HTTP ${respons.status}). Jalankan dari folder project: ` +
          '`npm start` di folder backend, lalu coba lagi.',
      respons.status,
    )
  }

  let isi = null
  try {
    isi = await respons.json()
  } catch {
    throw new GalatApi(`Respons server tidak dapat dibaca (HTTP ${respons.status}).`, respons.status)
  }

  if (!respons.ok || !isi || isi.ok !== true) {
    const pesan = (isi && typeof isi.pesan === 'string' && isi.pesan) || `Permintaan gagal (HTTP ${respons.status}).`
    throw new GalatApi(pesan, respons.status, isi)
  }
  return isi.data
}

// Token selalu dibaca dari sesi aktif, termasuk bila dirotasi tab pembeli.
export async function tokenCsrfAmbil() {
  const data = await minta('/auth/csrf-token')
  if (!data?.csrf_token) throw new GalatApi('Token keamanan tidak tersedia. Coba lagi.', 0)
  return String(data.csrf_token)
}

async function tulis(metode, jalur, badan) {
  const token = await tokenCsrfAmbil()
  return minta(jalur, {
    method: metode,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || '',
    },
    body: JSON.stringify(badan ?? {}),
  })
}

function susunKueri(params) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ===================== Autentikasi admin =====================

// Data sesi admin saat ini: { admin: {...} } atau null.
export async function sesiAdmin() {
  const data = await minta('/auth/saya')
  return data && data.admin ? data.admin : null
}

export async function masukAdmin(pengguna, sandi) {
  const token = await tokenCsrfAmbil()
  const data = await minta('/auth/masuk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
    body: JSON.stringify({ pengguna: String(pengguna || '').trim(), sandi: String(sandi || '') }),
  })
  return data
}

export async function keluarAdmin() {
  const token = await tokenCsrfAmbil()
  await minta('/auth/keluar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
  })
}

// ===================== Dasbor =====================
export const ambilDasbor = () => minta('/dasbor')

// ===================== Produk =====================
export const daftarProdukApi = (params) => minta(`/produk${susunKueri(params)}`)
export const ambilProdukApi = (id) => minta(`/produk/${encodeURIComponent(id)}`)
export const buatProdukApi = (data) => tulis('POST', '/produk', data)
export const ubahProdukApi = (id, data) => tulis('PUT', `/produk/${encodeURIComponent(id)}`, data)
export const hapusProdukApi = (id) => tulis('DELETE', `/produk/${encodeURIComponent(id)}`)

// ===================== Kategori =====================
export const daftarKategoriApi = () => minta('/kategori')
export const buatKategoriApi = (data) => tulis('POST', '/kategori', data)
export const ubahKategoriApi = (id, data) => tulis('PUT', `/kategori/${encodeURIComponent(id)}`, data)
export const hapusKategoriApi = (id) => tulis('DELETE', `/kategori/${encodeURIComponent(id)}`)

// ===================== Pesanan =====================
export const daftarPesananApi = (params) => minta(`/pesanan${susunKueri(params)}`)
export const ambilPesananApi = (id) => minta(`/pesanan/${encodeURIComponent(id)}`)
export const ubahStatusPesananApi = (id, status) => tulis('PUT', `/pesanan/${encodeURIComponent(id)}`, { status })
export const hapusPesananApi = (id) => tulis('DELETE', `/pesanan/${encodeURIComponent(id)}`)

// ===================== Pelanggan =====================
export const daftarPelangganApi = () => minta('/pelanggan')
export const ambilPelangganApi = (id) => minta(`/pelanggan/${encodeURIComponent(id)}`)
export const buatPelangganApi = (data) => tulis('POST', '/pelanggan', data)
export const ubahPelangganApi = (id, data) => tulis('PUT', `/pelanggan/${encodeURIComponent(id)}`, data)
export const hapusPelangganApi = (id) => tulis('DELETE', `/pelanggan/${encodeURIComponent(id)}`)

// ===================== Creator =====================
export const daftarCreatorApi = () => minta('/creator')
export const buatCreatorApi = (data) => tulis('POST', '/creator', data)
export const ubahCreatorApi = (id, data) => tulis('PUT', `/creator/${encodeURIComponent(id)}`, data)
export const hapusCreatorApi = (id) => tulis('DELETE', `/creator/${encodeURIComponent(id)}`)

// ===================== Promo =====================
export const daftarPromoApi = () => minta('/promo')
export const cekPromoApi = (kode) => minta(`/promo/cek${susunKueri({ kode })}`)
export const buatPromoApi = (data) => tulis('POST', '/promo', data)
export const ubahPromoApi = (id, data) => tulis('PUT', `/promo/${encodeURIComponent(id)}`, data)
export const hapusPromoApi = (id) => tulis('DELETE', `/promo/${encodeURIComponent(id)}`)

// ===================== Ulasan =====================
export const daftarUlasanApi = () => minta('/ulasan')
export const ubahStatusUlasanApi = (id, status) => tulis('PUT', `/ulasan/${encodeURIComponent(id)}`, { status })
export const hapusUlasanApi = (id) => tulis('DELETE', `/ulasan/${encodeURIComponent(id)}`)

// ===================== Media =====================
export const daftarMediaApi = (params) => minta(`/media${susunKueri(params)}`)
export const hapusMediaApi = (id) => tulis('DELETE', `/media/${encodeURIComponent(id)}`)
// Unggah multipart: jangan set Content-Type (browser mengisi boundary).
export async function unggahMediaApi(berkas, jenis = 'Thumbnail') {
  const token = await tokenCsrfAmbil()
  const metadata = await minta('/media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
    body: JSON.stringify({ namaAsli: berkas.name, mime: berkas.type, ukuran: berkas.size, jenis }),
  })
  if (metadata?.uploadUrl) {
    let respons
    try {
      respons = await fetch(metadata.uploadUrl, { method: 'PUT', headers: metadata.headers, body: berkas })
    } catch {
      throw new GalatApi('Berkas tidak dapat dikirim ke penyimpanan. Periksa koneksi.', 0)
    }
    if (!respons.ok) throw new GalatApi(`Penyimpanan menolak berkas (HTTP ${respons.status}).`, respons.status)
    return minta('/media/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
      body: JSON.stringify({ objectKey: metadata.objectKey, namaAsli: berkas.name, mime: berkas.type, jenis }),
    })
  }
  const fd = new FormData()
  fd.append('berkas', berkas)
  fd.append('jenis', jenis)
  return minta('/media', { method: 'POST', headers: { 'X-CSRF-Token': token || '' }, body: fd })
}

// ===================== Aktivitas =====================
export const daftarAktivitasApi = (batas) => minta(`/aktivitas${susunKueri({ batas })}`)
export const kosongkanAktivitasApi = () => tulis('DELETE', '/aktivitas')

// ===================== Manajemen Admin User (Superadmin only) ====================
export const daftarAdminApi = () => minta('/auth/admin')
export const ubahAdminApi = (id, data) => tulis('PUT', `/auth/admin/${encodeURIComponent(id)}`, data)
export const hapusAdminApi = (id) => tulis('DELETE', `/auth/admin/${encodeURIComponent(id)}`)

// ===================== Reseller (admin / superadmin) =====================
export const daftarResellerApi = (params) => minta(`/reseller${susunKueri(params)}`)
export const ambilResellerApi = (id) => minta(`/reseller/${encodeURIComponent(id)}`)
export const ubahStatusResellerApi = (id, data) => tulis('PUT', `/reseller/${encodeURIComponent(id)}/status`, data)

export default {
  sesiAdmin,
  masukAdmin,
  keluarAdmin,
  tokenCsrfAmbil,
  ambilDasbor,
  daftarProdukApi,
  ambilProdukApi,
  buatProdukApi,
  ubahProdukApi,
  hapusProdukApi,
  daftarKategoriApi,
  buatKategoriApi,
  ubahKategoriApi,
  hapusKategoriApi,
  daftarPesananApi,
  ambilPesananApi,
  ubahStatusPesananApi,
  hapusPesananApi,
  daftarPelangganApi,
  ambilPelangganApi,
  buatPelangganApi,
  ubahPelangganApi,
  hapusPelangganApi,
  daftarCreatorApi,
  buatCreatorApi,
  ubahCreatorApi,
  hapusCreatorApi,
  daftarPromoApi,
  cekPromoApi,
  buatPromoApi,
  ubahPromoApi,
  hapusPromoApi,
  daftarUlasanApi,
  ubahStatusUlasanApi,
  hapusUlasanApi,
  daftarMediaApi,
  unggahMediaApi,
  hapusMediaApi,
  daftarAktivitasApi,
  kosongkanAktivitasApi,
  daftarAdminApi,
  ubahAdminApi,
  hapusAdminApi,
  daftarResellerApi,
  ambilResellerApi,
  ubahStatusResellerApi,
}
