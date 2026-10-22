// Layanan reseller pembeli (toko depan) — SELALU ke backend PHP nyata.
//
// Endpoint:
//   GET  /api/reseller/saya            -> satu pengajuan terbaru pembeli login
//   POST /api/reseller                  -> kirim pengajuan reseller (CSRF wajib)
//   POST /api/reseller/{id}/batal       -> batal ajuan (status pending)
//
// Identitas pemohon diambil backend dari sesi pembeli — body request tidak
// mengandung user_id/pelanggan_id (cukup whatsapp + catatan) agar tidak
// bisa disetel klien. Respons: { ok, data?, pesan }.

import { ambilTokenCsrf } from './layananSesiPembeli.js'

const API = '/api'

async function minta(jalur, opsi = {}) {
  let respons
  try {
    respons = await fetch(`${API}${jalur}`, {
      ...opsi,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(opsi.headers || {}) },
    })
  } catch {
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi Anda.')
  }

  // Proxy Vite mengembalikan 502 bila backend PHP mati — beri pesan jujur.
  if (respons.status === 502 || respons.status === 503 || respons.status === 504) {
    let pesanBackend = ''
    try {
      const j = await respons.json()
      pesanBackend = (j && typeof j.pesan === 'string' && j.pesan) || ''
    } catch { /* non-JSON */ }
    throw new Error(
      pesanBackend ||
        `Backend API tidak aktif (HTTP ${respons.status}). Jalankan backend PHP di port 8000 ` +
        '(`php -S localhost:8000 -t backend backend/api/index.php` dari folder project) lalu coba lagi.'
    )
  }

  let isi
  try {
    isi = await respons.json()
  } catch {
    throw new Error(`Respons server tidak dapat dibaca (HTTP ${respons.status}).`)
  }
  if (!respons.ok || !isi || isi.ok !== true) {
    const err = new Error((isi && isi.pesan) || `Permintaan gagal (HTTP ${respons.status}).`)
    err.status = respons.status
    err.data = isi
    throw err
  }
  return isi.data
}

// Status pengajuan terbaru pembeli yang login (null bila belum pernah ajukan).
export async function statusReseller() {
  return minta('/reseller/saya')
}

// Kirim pengajuan reseller. Hanya butuh kontak + catatan; nama/email/username
// diisi backend dari sesi. Mencegah double-submit lewat flag yang dikunci di
// state komponen (lihat PengajuanReseller.jsx).
export async function kirimReseller(whatsapp, catatan = '') {
  const token = await ambilTokenCsrf()
  return minta('/reseller', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || '',
    },
    body: JSON.stringify({ whatsapp: String(whatsapp || '').trim(), catatan: String(catatan || '').trim() }),
  })
}

export async function batalReseller(id) {
  const token = await ambilTokenCsrf()
  return minta(`/reseller/${encodeURIComponent(id)}/batal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
  })
}

export default { statusReseller, kirimReseller, batalReseller }
