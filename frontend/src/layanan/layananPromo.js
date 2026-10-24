// Layanan promo: kode diskon & kampanye (mulai kosong, diisi admin).

import { buatKoleksi } from './layananKoleksi.js'
import { catat } from './layananAktivitas.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_PROMO } from '../data/konstanta.js'

const koleksi = buatKoleksi('promo', 'prm')

export const subscribePromo = (dengar) => koleksi.berlangganan(dengar)

export const formKosong = () => ({
  kode: '',
  nama: '',
  diskon: 10,
  mulai: '',
  berakhir: '',
  batas: 100,
})

export const daftarPromo = memo(() => koleksi.daftar())

export const ambilPromoKode = memo((kode) =>
  koleksi.ambil((p) => p.kode === String(kode || '').trim().toUpperCase()),
)

function normalisasi(data) {
  const kode = String(data.kode || '').trim().toUpperCase()
  const mulai = data.mulai || ''
  const berakhir = data.berakhir || ''

  // Status otomatis dari tanggal hari ini.
  const hariIni = new Date().toISOString().slice(0, 10)
  let status = STATUS_PROMO[1]
  if (mulai && berakhir) {
    if (hariIni < mulai) status = 'Terjadwal'
    else if (hariIni > berakhir) status = 'Berakhir'
    else status = 'Aktif'
  }

  return {
    kode,
    nama: String(data.nama || '').trim(),
    diskon: Math.min(100, Math.max(0, Number(data.diskon) || 0)),
    mulai,
    berakhir,
    batas: Math.max(1, Number(data.batas) || 1),
    terpakai: 0,
    status,
  }
}

export function tambahPromo(data) {
  const isi = normalisasi(data)
  if (!isi.kode) return { berhasil: false, pesan: 'Kode promo wajib diisi.' }
  if (!isi.nama) return { berhasil: false, pesan: 'Nama promo wajib diisi.' }
  if (ambilPromoKode(isi.kode)) return { berhasil: false, pesan: `Kode "${isi.kode}" sudah dipakai.` }

  const baru = koleksi.tambah(isi)
  catat({ teks: `Promo "${isi.nama}" dibuat`, ikon: 'promo', warna: 'hijau' })
  return { berhasil: true, data: baru }
}

export function perbaruiPromo(id, data) {
  const lama = koleksi.ambil(id)
  if (!lama) return { berhasil: false, pesan: 'Promo tidak ditemukan.' }

  const isi = normalisasi({ ...lama, ...data })
  const bentrok = koleksi.ambil((p) => p.kode === isi.kode && p.id !== id)
  if (bentrok) return { berhasil: false, pesan: `Kode "${isi.kode}" sudah dipakai.` }

  const baru = koleksi.perbarui(id, isi)
  catat({ teks: `Promo "${isi.nama}" diperbarui`, ikon: 'edit', warna: 'hijau' })
  return { berhasil: true, data: baru }
}

export function hapusPromo(id) {
  const promo = koleksi.ambil(id)
  if (!promo) return { berhasil: false, pesan: 'Promo tidak ditemukan.' }
  koleksi.hapus(id)
  catat({ teks: `Promo "${promo.nama}" dihapus`, ikon: 'hapus', warna: 'merah' })
  return { berhasil: true }
}

export default {
  daftar: daftarPromo,
  ambil: ambilPromoKode,
  subscribe: subscribePromo,
  subscribePromo,
  tambah: tambahPromo,
  perbarui: perbaruiPromo,
  hapus: hapusPromo,
  formKosong,
}
