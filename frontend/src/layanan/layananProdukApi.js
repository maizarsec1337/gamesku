// Layanan produk API: baca katalog produk dari backend Express (GET /api/produk).
// Read-only. Data asli dari database MySQL — bukan contoh.
// Endpoint ini dipakai oleh tamu (tidak login) karena produk hanya tetap
// tampil bila statusnya Aktif.

import { GalatAnime } from './layananAnime.js'
import { URL_API } from './urlApi.js'

const DASAR_API = URL_API

// Panggil fetch, parse, dan validasi respons. Melempar GalatAnime saat gagal.
async function minta(jalur) {
  let respons
  try {
    respons = await fetch(`${DASAR_API}${jalur}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // Gagal jaringan / server mati — jangan diam-diam pakai data contoh.
    throw new GalatAnime('Tidak dapat menghubungi server. Periksa koneksi Anda.', 0)
  }
  let isi = null
  try {
    isi = await respons.json()
  } catch {
    throw new GalatAnime('Respons server tidak dapat dibaca.', respons.status)
  }
  if (!respons.ok || !isi || isi.ok !== true) {
    const pesan = (isi && typeof isi.pesan === 'string' && isi.pesan) || 'Permintaan gagal diproses.'
    throw new GalatAnime(pesan, respons.status)
  }
  return Array.isArray(isi.data) ? isi.data : []
}

// Bentuk baris produk agar tahan dua gaya respons API (camelCase / snake_case).
function normalisasiProduk(p) {
  if (!p || typeof p !== 'object') return null
  return {
    ...p,
    id: p.id ?? p.slug ?? '',
    kategoriId: p.kategoriId ?? p.kategori_id ?? '',
    kategoriNama: p.kategoriNama ?? p.kategori_nama ?? '',
    deskripsiSingkat: p.deskripsiSingkat ?? p.deskripsi_singkat ?? '',
    harga: Number(p.harga ?? 0) || 0,
    hargaDiskon: Number(p.hargaDiskon ?? p.harga_diskon ?? 0) || 0,
  }
}
// Parameter:
//   kataKunci  — pencarian di nama / creator / slug (opsional)
//   filterKategori — filter berdasarkan nama kategori (opsional)
//   filterJenis  — filter berdasarkan jenis produk (opsional)
export async function daftarProdukDariApi({ kataKunci = '', filterKategori = '', filterJenis = '' } = {}) {
  const params = new URLSearchParams()
  if (kataKunci !== '') params.set('cari', kataKunci)
  if (filterKategori !== '') params.set('kategori', filterKategori)
  if (filterJenis !== '') params.set('jenis', filterJenis)
  const s = params.toString()
  const mentah = await minta(`/produk${s ? `?${s}` : ''}`)
  // Baca katalog produk aktif dari API.
  return mentah.map(normalisasiProduk).filter(Boolean)
}

