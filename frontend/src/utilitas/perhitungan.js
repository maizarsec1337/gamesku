// Perhitungan keranjang dan pesanan dari data nyata.

import { ambilPromoKode } from '../layanan/layananPromo.js'

// Biaya layanan tetap untuk setiap transaksi.
export const BIAYA_LAYANAN = 1000

// Harga satu item dikalikan jumlahnya.
export function hitungSubtotalItem(item) {
  if (!item) return 0
  return (Number(item.harga) || 0) * (Number(item.jumlah) || 0)
}

export function hitungSubtotal(daftarItem = []) {
  return daftarItem.reduce((total, item) => total + hitungSubtotalItem(item), 0)
}

export function hitungJumlahItem(daftarItem = []) {
  return daftarItem.reduce((total, item) => total + (Number(item.jumlah) || 0), 0)
}

// Mencari promo berdasarkan kode yang dimasukkan pembeli (dibuat admin).
export function cariPromo(kode) {
  if (!kode) return undefined
  return ambilPromoKode(kode)
}

// Menghitung potongan harga dari sebuah kode promo.
export function hitungPotongan(subtotal, kode) {
  const promo = cariPromo(kode)
  if (!promo || subtotal <= 0) return { potongan: 0, berlaku: false, promo: undefined }

  // Promo tanpa persentase berarti menggratiskan biaya layanan.
  if (!promo.diskon) {
    return { potongan: BIAYA_LAYANAN, berlaku: true, promo }
  }

  const potongan = Math.min(Math.round((subtotal * promo.diskon) / 100), 50000)
  return { potongan, berlaku: true, promo }
}

// Ringkasan belanja: subtotal, biaya layanan, potongan, dan total akhir.
export function hitungRingkasan(daftarItem = [], kodePromo = '') {
  const subtotal = hitungSubtotal(daftarItem)
  const adaItem = daftarItem.length > 0
  const { potongan, berlaku, promo } = hitungPotongan(subtotal, kodePromo)
  const biayaLayanan = adaItem ? BIAYA_LAYANAN : 0
  const totalAkhir = Math.max(subtotal + biayaLayanan - potongan, 0)

  return {
    subtotal,
    jumlahItem: hitungJumlahItem(daftarItem),
    biayaLayanan,
    potongan: berlaku ? potongan : 0,
    promo: berlaku ? promo : undefined,
    total: totalAkhir,
  }
}

// Total sebuah pesanan yang sudah tersimpan.
export function hitungTotalPesanan(pesanan) {
  if (!pesanan) return 0
  const subtotal = hitungSubtotal(pesanan.item)
  return Math.max(subtotal + (pesanan.biayaLayanan || 0) - (pesanan.potongan || 0), 0)
}

// Membuat nomor pesanan baru dengan format GK-YYMM-XXXX.
export function buatNomorPesanan() {
  const sekarang = new Date()
  const tahun = String(sekarang.getFullYear()).slice(-2)
  const bulan = String(sekarang.getMonth() + 1).padStart(2, '0')
  const acak = String(Math.floor(1000 + Math.random() * 9000))
  return `GK-${tahun}${bulan}-${acak}`
}
