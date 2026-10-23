// Status sesi PEMBELI (toko depan), terpisah dari sesi admin.
//
// Backend buyer tersedia melalui:
//   GET  /api/auth/csrf-token   ambil token CSRF
//   POST /api/pelanggan/masuk   login pembeli (email + sandi)
//   GET  /api/pelanggan/saya    cek sesi pembeli saat ini
//   POST /api/pelanggan/keluar  logout pembeli
//   POST /api/pelanggan         daftar pembeli baru (nama, email, sandi)
//
// Kunci sesi: $_SESSION['pembeli'] (PHP cookie), terpisah dari $_SESSION['admin'].
// JANGAN mengarang sesi pembeli dari localStorage / koleksi lokal:
// `buatKoleksi('pelanggan')` hanya menyimpan nama+email pendaftar di browser,
// tanpa password_verify dan tanpa cookie sesi server bukan bukti login.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import {
  cekSesiPembeli,
  masukPembeli as apiMasukPembeli,
  keluarPembeli as apiKeluarPembeli,
  daftarPembeli as apiDaftarPembeli,
} from '../layanan/layananSesiPembeli.js'

export const KonteksSesiPembeli = createContext(null)

export function useSesiPembeli() {
  const nilai = useContext(KonteksSesiPembeli)
  if (!nilai) throw new Error('useSesiPembeli memerlukan PenyediaSesiPembeli.')
  return nilai
}

export function useStatusSesiPembeli() {
  const [status, setStatus] = useState('memuat') // 'memuat' | 'masuk' | 'belum-masuk'
  const [sesi, setSesi] = useState(null)
  const [error, setError] = useState(null)
  const versiSesi = useRef(0)

  // Pemeriksaan sesi saat mount. Tidak memakai useCallback terpisah agar
  // tidak ada missing-dependency / set-state-in-effect warning.
  useEffect(() => {
    let abaikan = false
    const versi = versiSesi.current
    ;(async () => {
      try {
        const data = await cekSesiPembeli()
        if (abaikan || versi !== versiSesi.current) return
        const pembeli = data && data.pembeli ? data.pembeli : null
        setSesi(pembeli)
        setStatus(pembeli ? 'masuk' : 'belum-masuk')
        setError(null)
      } catch (e) {
        if (abaikan || versi !== versiSesi.current) return
        // Tidak ada sesi yang valid (401, jaringan mati, atau server error)
        // Tampilkan form login di /profil ketika pemeriksaan gagal,
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
    versiSesi.current += 1
    setSesi(data)
    setStatus('masuk')
    return data
  }, [])

  const keluar = useCallback(async () => {
    try {
      await apiKeluarPembeli()
    } catch (e) {
      setError(e.message || 'Gagal keluar. Silakan coba lagi.')
      throw e
    }
    versiSesi.current += 1
    setError(null)
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
