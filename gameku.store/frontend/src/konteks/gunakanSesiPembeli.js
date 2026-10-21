// Status sesi PEMBELI (toko depan) — BUKAN sesi admin.
//
// Backend buyer tersedia melalui:
//   POST /api/auth/csrf-token   ambil token CSRF
//   POST /api/pelanggan/masuk   login pembeli (email + sandi)
//   GET  /api/pelanggan/saya    cek sesi pembeli saat ini
//   POST /api/pelanggan/keluar  logout pembeli
//   POST /api/pelanggan         daftar pembeli baru (nama, email, sandi)
//
// Kunci sesi: $_SESSION['pembeli'] (PHP cookie), terpisah dari $_SESSION['admin'].
// JANGAN mengarang sesi pembeli dari localStorage / koleksi lokal:
// `buatKoleksi('pelanggan')` hanya menyimpan nama+email pendaftar di browser,
// tanpa password_verify dan tanpa cookie sesi server — bukan bukti login.8
import { useCallback, useEffect, useState } from 'react'

import {
  cekSesiPembeli,
  masukPembeli as apiMasukPembeli,
  keluarPembeli as apiKeluarPembeli,
  daftarPembeli as apiDaftarPembeli,
} from '../layanan/layananSesiPembeli.js'

export function useSesiPembeli() {
  const [status, setStatus] = useState('memuat') // 'memuat' | 'masuk' | 'belum-masuk'
  const [sesi, setSesi] = useState(null)
  const [error, setError] = useState(null)

  // Pemeriksaan sesi saat mount. Tidak memakai useCallback terpisah agar
  // tidak ada missing-dependency / set-state-in-effect warning.
  useEffect(() => {
    let abaikan = false
    ;(async () => {
      try {
        const data = await cekSesiPembeli()
        if (abaikan) return
        const pembeli = data && data.pembeli ? data.pembeli : null
        setSesi(pembeli)
        setStatus(pembeli ? 'masuk' : 'belum-masuk')
        setError(null)
      } catch (e) {
        if (abaikan) return
        // Tidak ada sesi yang valid (401, jaringan mati, atau server error)
        // → treat sebagai belum masuk agar /profil selalu menampilkan form login,
        // tidak pernah tertahan di layar loading selamanya.
        setSesi(null)
        setStatus('belum-masuk')
        setError(e.status === 401 ? 'Sesi tidak valid. Silakan masuk kembali.' : (e.message || 'Gagal memeriksa sesi.'))
      }
    })()
    return () => { abaikan = true }
  }, [])

  const masuk = useCallback(async (email, sandi) => {
    setError(null)
    const data = await apiMasukPembeli(email, sandi)
    setSesi(data)
    setStatus('masuk')
    return data
  }, [])

  const keluar = useCallback(async () => {
    try {
      await apiKeluarPembeli()
    } catch {
      // Tetap bersihkan state lokal meskipun server gagal.
    }
    setSesi(null)
    setStatus('belum-masuk')
  }, [])

  const daftar = useCallback(async (nama, email, sandi) => {
    setError(null)
    return apiDaftarPembeli(nama, email, sandi)
  }, [])

  return {
    status,
    sesi,
    memuat: status === 'memuat',
    masuk: status === 'masuk',
    masukFungsi: masuk,
    keluar,
    daftar,
    error,
  }
}
