// Layanan dasbor: statistik, grafik, dan ringkasan admin (semua dari data nyata).

import { daftarProduk, subscribeProduk } from './layananProduk.js'
import {
  daftarPesanan,
  pesananTerbaru,
  pesananBerhasil,
  hitungPerStatus,
  subscribePesanan,
} from './layananPesanan.js'
import { daftarPelanggan, subscribePelanggan } from './layananPelanggan.js'
import { daftarKategori, subscribeKategori } from './layananKategori.js'
import { daftarCreator, subscribeCreator } from './layananCreator.js'
import { daftarPromo, subscribePromo } from './layananPromo.js'
import { daftarUlasan, subscribeUlasan } from './layananUlasan.js'
import { daftarMedia, subscribeMedia } from './layananMedia.js'
import { subscribeAktivitas } from './layananAktivitas.js'
import { formatRupiah, formatAngka } from '../utilitas/format.js'
import { memo } from './penyimpananLokal.js'

// Statistik utama.
export const statistikDasbor = memo(() => {
  const produk = daftarProduk()
  const pesanan = daftarPesanan()
  const pelanggan = daftarPelanggan()
  const pendapatan = pesananBerhasil().reduce((total, p) => total + (Number(p.total) || 0), 0)

  return [
    {
      id: 'produk',
      judul: 'Total Produk',
      ikon: 'kotak',
      warna: 'hijau',
      nilai: formatAngka(produk.length),
      ket: 'produk di katalog',
    },
    {
      id: 'pesanan',
      judul: 'Total Pesanan',
      ikon: 'pesanan',
      warna: 'hijau',
      nilai: formatAngka(pesanan.length),
      ket: 'transaksi masuk',
    },
    {
      id: 'pelanggan',
      judul: 'Total Pelanggan',
      ikon: 'pelanggan',
      warna: 'hijau',
      nilai: formatAngka(pelanggan.length),
      ket: 'akun terdaftar',
    },
    {
      id: 'pendapatan',
      judul: 'Total Pendapatan',
      ikon: 'dompet',
      warna: 'coklat',
      nilai: formatRupiah(pendapatan),
      ket: 'dari pesanan berhasil',
    },
  ]
})

// Deret penjualan per hari; array kosong bila belum ada transaksi.
export const grafikPenjualan = memo((hari = 14) => {
  const pesanan = pesananBerhasil()
  if (!pesanan.length) return []

  const hasil = []
  for (let mundur = hari - 1; mundur >= 0; mundur -= 1) {
    const hariIni = new Date()
    hariIni.setHours(0, 0, 0, 0)
    const target = new Date(hariIni)
    target.setDate(target.getDate() - mundur)
    const kunci = target.toISOString().slice(0, 10)

    const total = pesanan
      .filter((p) => String(p.dibuatPada || p.tanggal || '').slice(0, 10) === kunci)
      .reduce((jumlah, p) => jumlah + (Number(p.total) || 0), 0)

    hasil.push({
      tanggal: kunci,
      label: target.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      total,
    })
  }
  return hasil
})

// Produk terlaris; kosong bila belum ada transaksi.
export const produkTerlaris = memo((jumlah = 5) => {
  const pesanan = pesananBerhasil()
  if (!pesanan.length) return []

  const rekap = new Map()
  for (const pesananItem of pesanan) {
    const nama = pesananItem.produk
    if (!nama) continue
    const lama = rekap.get(nama) || { nama, terjual: 0, pendapatan: 0 }
    lama.terjual += 1
    lama.pendapatan += Number(pesananItem.total) || 0
    rekap.set(nama, lama)
  }

  return [...rekap.values()]
    .sort((a, b) => b.pendapatan - a.pendapatan)
    .slice(0, jumlah)
    .map((baris, i) => ({ ...baris, peringkat: String(i + 1).padStart(2, '0') }))
})

// Ringkasan jumlah isi tiap tabel.
export const ringkasanIsi = memo(() => ({
  produk: daftarProduk().length,
  kategori: daftarKategori().length,
  pesanan: daftarPesanan().length,
  pelanggan: daftarPelanggan().length,
  creator: daftarCreator().length,
  promo: daftarPromo().length,
  ulasan: daftarUlasan().length,
  media: daftarMedia().length,
}))

// Ringkasan dasbor: statistik + pesanan terbaru dalam satu objek.
export const ringkasanDasbor = memo(() => ({
  statistik: statistikDasbor(),
  terbaru: pesananTerbaru(6),
  terlaris: produkTerlaris(5),
  ringkasan: ringkasanIsi(),
}))

// Berlangganan semua sumber data agar dasbor memuat ulang otomatis.
export const subscribeDasbor = (dengar) => {
  const berhenti = [
    subscribePesanan(dengar),
    subscribeProduk(dengar),
    subscribeKategori(dengar),
    subscribePelanggan(dengar),
    subscribeCreator(dengar),
    subscribePromo(dengar),
    subscribeUlasan(dengar),
    subscribeMedia(dengar),
    subscribeAktivitas(dengar),
  ]
  return () => berhenti.forEach((fn) => fn())
}

export { hitungPerStatus, pesananTerbaru }
