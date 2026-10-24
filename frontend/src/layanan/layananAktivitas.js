// Layanan aktivitas: jejak aksi admin (tanpa data contoh).

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'

const koleksi = buatKoleksi('aktivitas', 'akt')

export const subscribeAktivitas = (dengar) => koleksi.berlangganan(dengar)

// Maksimal jejak yang disimpan di browser.
const BATAS = 50

export function catat({ teks, ikon = 'centangLingkaran', warna = 'hijau' }) {
  if (!teks) return null
  const baru = koleksi.tambah({ teks, ikon, warna })
  const isi = koleksi.daftar()
  if (isi.length > BATAS) koleksi.gantiSemua(isi.slice(0, BATAS))
  return baru
}

export const daftarAktivitas = memo(() => koleksi.daftar())

export const kosongkanAktivitas = () => koleksi.gantiSemua([])

export default {
  catat,
  daftar: daftarAktivitas,
  subscribe: subscribeAktivitas,
  subscribeAktivitas,
  kosongkan: kosongkanAktivitas,
}
