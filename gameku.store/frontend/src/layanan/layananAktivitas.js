// =====================================================================
// LAYANAN AKTIVITAS — jejak kejadian yang benar-benar terjadi.
//
// TIDAK ADA aktivitas contoh. Pada tahap UI, setiap aktivitas lahir
// dari aksi nyata admin (tambah/edit/hapus produk, kategori, promo, ...).
// Nanti sumbernya diganti tabel `aktivitas` dari database.
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'

const koleksi = buatKoleksi('aktivitas', 'akt')

// Berlangganan perubahan aktivitas.
export const subscribeAktivitas = (dengar) => koleksi.berlangganan(dengar)

// Maksimal jejak yang disimpan di browser.
const BATAS = 50

// Mencatat satu aktivitas nyata.
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
