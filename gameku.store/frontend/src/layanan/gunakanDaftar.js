// =====================================================================
// HOOK DAFTAR — jembatan penghubung service (localStorage) dengan React.
//
// Dipakai halaman admin untuk membaca daftar dan otomatis memuat ulang
// setiap kali koleksi berubah. Komponen tidak pernah menyentuh
// localStorage secara langsung — semuanya lewat src/layanan.
//
//   const produk = useDaftar(layananProduk, 'daftar')
// =====================================================================

import { useCallback, useSyncExternalStore } from 'react'

// Berlangganan kosong untuk service tanpa koleksi (mis. statistic).
const tanpaLangganan = () => () => {}

// Nama fungsi pembaca pada service (default: "daftar").
export function useDaftar(layanan, namaPembaca = 'daftar') {
  const pembaca = useCallback(
    () => (typeof layanan[namaPembaca] === 'function' ? layanan[namaPembaca]() : []),
    [layanan, namaPembaca],
  )

  // Jaring pengaman: bila nama pembaca salah, kembalikan array kosong
  // yang stabil (const di luar fungsi) — bukan array baru tiap render.
  const snapshot = useCallback(() => {
    const nilai = pembaca()
    return Array.isArray(nilai) ? nilai : KOSONG
  }, [pembaca])

  // Semua service mengekspos `subscribe` (alias: `berlangganan`).
  // Bila tidak ada, pakai langganan kosong agar halaman tetap merender.
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

// Memuat ulang daftar setiap kali pathname berubah (mis. setelah
// pindah halaman, agar data terbaru langsung tampil).
export function useMuatUlang(jalankan) {
  return useCallback(() => {
    if (typeof jalankan === 'function') jalankan()
  }, [jalankan])
}
