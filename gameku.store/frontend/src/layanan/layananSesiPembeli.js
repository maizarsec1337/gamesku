// Layanan sesi pembeli (toko depan) — BUKAN sesi admin.
//
// Endpoint backend buyer (PHP sesi + cookie):
//   GET    /api/auth/csrf-token   ambil token CSRF (mula-mulai sesi PHP)
//   POST   /api/pelanggan/masuk   login pembeli (email + sandi)
//   GET    /api/pelanggan/saya    cek sesi pembeli saat ini
//   POST   /api/pelanggan/keluar  logout pembeli
//   POST   /api/pelanggan         daftar pembeli baru (nama, email, sandi)
//
// Semua respons berbentuk { ok, data?, pesan }. Kegagalan jaringan atau
// respons tidak valid menghasilkan GalatAnime (tidak pernah diam-diam).

const API = '/api'

async function minta(jalur, opsi = {}) {
  // credentials: 'same-origin' agar cookie sesi (diset backend lewat
  // Set-Cookie melalui proxy Vite) dikirim kembali ke server setiap request.
  // Tanpa ini sesi pembeli tidak pernah bertahan setelah login.
  const respons = await fetch(`${API}${jalur}`, {
    ...opsi,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(opsi.headers || {}) },
  })
  let isi
  try {
    isi = await respons.json()
  } catch {
    throw new Error('Respons server tidak dapat dibaca.')
  }
  if (!respons.ok || !isi || isi.ok !== true) {
    const err = new Error((isi && isi.pesan) || 'Permintaan gagal diproses.')
    err.status = respons.status
    err.data = isi
    throw err
  }
  return isi.data
}

let tokenCsrf = null

// Ambil (dan simpan di cache) token CSRF dari backend. Token ini wajib
// disertakan dalam header X-CSRF-Token pada setiap POST state-changing.
export async function ambilTokenCsrf() {
  if (tokenCsrf) return tokenCsrf
  const data = await minta('/auth/csrf-token')
  tokenCsrf = data && data.csrf_token ? String(data.csrf_token) : ''
  return tokenCsrf
}

// Cek apakah pembeli sudah memiliki sesi server yang valid.
// Mengembalikan { pembeli: {...} } atau null.
export async function cekSesiPembeli() {
  return minta('/pelanggan/saya')
}

// Login pembeli. Mengembalikan data pembeli saat sukses.
export async function masukPembeli(email, sandi) {
  const token = await ambilTokenCsrf()
  return minta('/pelanggan/masuk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || '',
    },
    body: JSON.stringify({ email: String(email || '').trim(), sandi: String(sandi || '') }),
  })
}

// Logout pembeli (menghancurkan sesi server).
export async function keluarPembeli() {
  const token = await ambilTokenCsrf()
  await minta('/pelanggan/keluar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || '',
    },
  })
  tokenCsrf = null
}

// Daftar pembeli baru. Setelah sukses, caller biasanya langsung panggil masukPembeli.
export async function daftarPembeli(nama, email, sandi) {
  const token = await ambilTokenCsrf()
  return minta('/pelanggan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || '',
    },
    body: JSON.stringify({
      nama: String(nama || '').trim(),
      email: String(email || '').trim(),
      sandi: String(sandi || ''),
    }),
  })
}