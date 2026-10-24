// Hook useDaftar: jembatan service (localStorage) ke useSyncExternalStore.

import { useCallback, useSyncExternalStore } from 'react'

// Berlangganan kosong untuk service tanpa koleksi.
const tanpaLangganan = () => () => {}

export function useDaftar(layanan, namaPembaca = 'daftar') {
  const pembaca = useCallback(
    () => (typeof layanan[namaPembaca] === 'function' ? layanan[namaPembaca]() : []),
    [layanan, namaPembaca],
  )

  // Bila nama pembaca salah, kembalikan array kosong yang referensinya stabil.
  const snapshot = useCallback(() => {
    const nilai = pembaca()
    return Array.isArray(nilai) ? nilai : KOSONG
  }, [pembaca])

  // Pakai `subscribe`; bila tidak ada, langganan kosong agar tetap merender.
  const dengar = useCallback(
    (dengar) => {
      const ambil = layanan.subscribe || layanan.berlangganan
      return typeof ambil === 'function' ? ambil(dengar) : tanpaLangganan()
    },
    [layanan],
  )

  return useSyncExternalStore(dengar, snapshot, snapshot)
}

// Nilai tetap untuk kondisi kosong (referensi tidak pernah berubah).
const KOSONG = []

export function useMuatUlang(jalankan) {
  return useCallback(() => {
    if (typeof jalankan === 'function') jalankan()
  }, [jalankan])
}
