// Layanan pesanan: transaksi masuk toko (mulai kosong, diisi checkout/API).

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_PESANAN } from '../data/konstanta.js'

const koleksi = buatKoleksi('pesanan', 'psn')

// Pembacaan (memo: referensi stabil untuk useSyncExternalStore).
export const daftarPesanan = memo(() => koleksi.daftar())

export const ambilPesananId = memo((id) => koleksi.ambil(id))

// Pesanan berhasil — sumber hitungan pendapatan.
export const pesananBerhasil = memo(() => daftarPesanan().filter((p) => p.status === 'Berhasil'))

// Pesanan terbaru untuk dasbor.
export const pesananTerbaru = memo((jumlah = 6) =>
  [...daftarPesanan()]
    .sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
    .slice(0, jumlah),
)

// Jumlah pesanan per status (kartu ringkasan).
export const hitungPerStatus = memo(() => {
  const hasil = {}
  for (const status of STATUS_PESANAN) hasil[status] = 0
  for (const pesanan of daftarPesanan()) {
    if (pesanan.status in hasil) hasil[pesanan.status] += 1
  }
  return hasil
})

// Penulisan.
export function tambahPesanan(data) {
  if (!data || !data.pelanggan || !data.produk) {
    return { berhasil: false, pesan: 'Pesanan perlu data pelanggan dan produk.' }
  }
  const baru = koleksi.tambah({
    tanggal: data.tanggal || new Date().toISOString(),
    total: Math.max(0, Number(data.total) || 0),
    metode: data.metode || '',
    status: STATUS_PESANAN.includes(data.status) ? data.status : 'Menunggu',
    ...data,
  })
  return { berhasil: true, data: baru }
}

export function ubahStatusPesanan(id, status) {
  if (!STATUS_PESANAN.includes(status)) {
    return { berhasil: false, pesan: `Status "${status}" tidak dikenal.` }
  }
  const baru = koleksi.perbarui(id, { status })
  if (!baru) return { berhasil: false, pesan: 'Pesanan tidak ditemukan.' }
  return { berhasil: true, data: baru }
}

// Berlangganan perubahan pesanan (dasbor & sidebar ikut memuat ulang).
export const subscribePesanan = (dengar) => koleksi.berlangganan(dengar)

export default {
  daftar: daftarPesanan,
  ambil: ambilPesananId,
  subscribe: subscribePesanan,
  subscribePesanan,
  terbaru: pesananTerbaru,
  berhasil: pesananBerhasil,
  perStatus: hitungPerStatus,
  tambah: tambahPesanan,
  ubahStatus: ubahStatusPesanan,
}
