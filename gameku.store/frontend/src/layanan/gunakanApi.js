// Hook data async untuk halaman admin (dan halaman lain yang butuh).
// Menangani loading, error, dan pemuatan ulang — sumbernya API backend nyata.

import { useCallback, useEffect, useRef, useState } from 'react'

// useApi(pengambil, deps) → { data, memuat, galat, muat }
// pengambil: fungsi async yang mengembalikan data (mis. () => daftarProdukApi()).
export function useApi(pengambil, deps = []) {
  const [data, setData] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState(null)
  const refMounted = useRef(true)
  const refPermintaan = useRef(0)
  const refAmbil = useRef(pengambil)
  refAmbil.current = pengambil

  useEffect(() => {
    refMounted.current = true
    return () => {
      refMounted.current = false
      refPermintaan.current += 1
    }
  }, [])

  const muat = useCallback(async () => {
    const permintaan = ++refPermintaan.current
    const masihAktif = () => refMounted.current && permintaan === refPermintaan.current
    setMemuat(true)
    setGalat(null)
    try {
      const hasil = await refAmbil.current()
      if (masihAktif()) setData(hasil)
    } catch (e) {
      if (masihAktif()) {
        setGalat(e)
        setData(null)
      }
    } finally {
      if (masihAktif()) setMemuat(false)
    }
  }, [])

  // Muat ulang saat dependensi berubah.
  useEffect(() => {
    muat()
    return () => { refPermintaan.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, memuat, galat, muat, setData }
}

// Pesan galat standar untuk ditampilkan di UI.
export function pesanGalat(galat) {
  if (!galat) return ''
  if (galat.status === 401) return 'Sesi berakhir. Silakan masuk kembali.'
  if (galat.status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.'
  if (galat.status === 404) return 'Data tidak ditemukan.'
  if (galat.status === 422) return galat.message || 'Data tidak valid.'
  if (galat.status === 429) return 'Terlalu banyak permintaan. Coba lagi nanti.'
  if (galat.status === 500) return galat.message || 'Terjadi kesalahan pada server.'
  return galat.message || 'Gagal memuat data.'
}

export default { useApi, pesanGalat }
