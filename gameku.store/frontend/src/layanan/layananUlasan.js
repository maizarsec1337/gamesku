// =====================================================================
// LAYANAN ULASAN — ulasan produk dari pelanggan.
//
// MULAI KOSONG. Tidak ada ulasan contoh, tidak ada nama pelanggan
// karangan di halaman moderasi. Ulasan pertama muncul setelah ada
// transaksi nyata dan pelanggan menulis ulasan.
//
// Bentuk data meniru kolom tabel `ulasan`.
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_ULASAN } from '../data/konstanta.js'

const koleksi = buatKoleksi('ulasan', 'uls')

// Berlangganan perubahan ulasan.
export const subscribeUlasan = (dengar) => koleksi.berlangganan(dengar)

export const daftarUlasan = memo(() => koleksi.daftar())

export const ambilUlasanId = memo((id) => koleksi.ambil(id))

// Ulasan yang sudah disetujui (untuk tampil di halaman produk).
export const ulasanDisetujui = memo((produkId) =>
  daftarUlasan().filter((u) => u.status === 'Disetujui' && (!produkId || u.produkId === produkId)),
)

// Rata-rata rating satu produk. Tanpa ulasan => null (bukan 0 palsu).
export const rataRating = memo((produkId) => {
  const milik = ulasanDisetujui(produkId)
  if (!milik.length) return null
  return milik.reduce((total, u) => total + (Number(u.rating) || 0), 0) / milik.length
})

export function tambahUlasan(data) {
  if (!data?.produk || !data?.pelanggan) {
    return { berhasil: false, pesan: 'Ulasan perlu data produk dan pelanggan.' }
  }
  const baru = koleksi.tambah({
    produk: data.produk,
    produkId: data.produkId || '',
    pelanggan: data.pelanggan,
    rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
    komentar: data.komentar || '',
    tanggal: data.tanggal || new Date().toISOString(),
    status: STATUS_ULASAN[0],
  })
  return { berhasil: true, data: baru }
}

export function ubahStatusUlasan(id, status) {
  if (!STATUS_ULASAN.includes(status)) {
    return { berhasil: false, pesan: `Status "${status}" tidak dikenal.` }
  }
  const baru = koleksi.perbarui(id, { status })
  if (!baru) return { berhasil: false, pesan: 'Ulasan tidak ditemukan.' }
  return { berhasil: true, data: baru }
}

export function hapusUlasan(id) {
  const ulasan = koleksi.ambil(id)
  if (!ulasan) return { berhasil: false, pesan: 'Ulasan tidak ditemukan.' }
  koleksi.hapus(id)
  return { berhasil: true }
}

export default {
  daftar: daftarUlasan,
  ambil: ambilUlasanId,
  disetujui: ulasanDisetujui,
  rataRating,
  subscribe: subscribeUlasan,
  subscribeUlasan,
  tambah: tambahUlasan,
  ubahStatus: ubahStatusUlasan,
  hapus: hapusUlasan,
}
