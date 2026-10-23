// Layanan media: pustaka berkas (metadata; unggahan fisik lewat backend).

import { buatKoleksi } from './layananKoleksi.js'
import { catat } from './layananAktivitas.js'
import { memo } from './penyimpananLokal.js'
import { waktuRelatif } from '../data/konstanta.js'

const koleksi = buatKoleksi('media', 'med')

export const JENIS_MEDIA = ['Thumbnail', 'Banner', 'Preview', 'Gambar Produk']

export const subscribeMedia = (dengar) => koleksi.berlangganan(dengar)

export const daftarMedia = memo(() => koleksi.daftar())

export const ambilMediaId = memo((id) => koleksi.ambil(id))

export const cariMedia = memo((jenis) => {
  if (!jenis || jenis === 'Semua') return daftarMedia()
  return daftarMedia().filter((m) => m.jenis === jenis)
})

export function tambahMedia(berkas, jenis = 'Thumbnail') {
  if (!berkas?.name) return { berhasil: false, pesan: 'Berkas tidak valid.' }

  const baru = koleksi.tambah({
    nama: berkas.name,
    jenis: JENIS_MEDIA.includes(jenis) ? jenis : JENIS_MEDIA[0],
    ukuran: `${Math.max(1, Math.round((berkas.size || 0) / 1024))} KB`,
    tanggal: new Date().toISOString(),
    label: waktuRelatif(new Date().toISOString()),
  })
  catat({ teks: `Media "${berkas.name}" diunggah`, ikon: 'unggah', warna: 'biru' })
  return { berhasil: true, data: baru }
}

export function hapusMedia(id) {
  const media = koleksi.ambil(id)
  if (!media) return { berhasil: false, pesan: 'Media tidak ditemukan.' }
  koleksi.hapus(id)
  catat({ teks: `Media "${media.nama}" dihapus`, ikon: 'hapus', warna: 'merah' })
  return { berhasil: true }
}

export default {
  daftar: daftarMedia,
  ambil: ambilMediaId,
  cari: cariMedia,
  subscribe: subscribeMedia,
  subscribeMedia,
  tambah: tambahMedia,
  hapus: hapusMedia,
  jenis: JENIS_MEDIA,
}
