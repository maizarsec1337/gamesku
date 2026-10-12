// =====================================================================
// LAYANAN CREATOR — kreator konten Minecraft di RAK VIN.
//
// MULAI KOSONG. Tidak ada creator contoh. Creator pertama muncul setelah
// ada pendaftaran kreator lewat form undangan atau API PHP.
//
// Bentuk data meniru kolom tabel `creator`.
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { catat } from './layananAktivitas.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_CREATOR } from '../data/konstanta.js'

const koleksi = buatKoleksi('creator', 'cr')

// Berlangganan perubahan creator.
export const subscribeCreator = (dengar) => koleksi.berlangganan(dengar)

export const daftarCreator = memo(() => koleksi.daftar())

export const ambilCreatorId = memo((id) => koleksi.ambil(id))

// Nama creator unik (dipakai form produk).
export const daftarNamaCreator = memo(() =>
  [...new Set(daftarCreator().map((c) => c.nama).filter(Boolean))].sort(),
)

export function tambahCreator(data) {
  const nama = String(data?.nama || '').trim()
  if (!nama) return { berhasil: false, pesan: 'Nama creator wajib diisi.' }

  const baru = koleksi.tambah({
    nama,
    username: data.username || '',
    produk: 0,
    penjualan: 0,
    pendapatan: 0,
    bergabung: data.bergabung || new Date().toISOString(),
    status: STATUS_CREATOR[1],
  })
  catat({ teks: `Creator "${nama}" mendaftar`, ikon: 'kreator', warna: 'biru' })
  return { berhasil: true, data: baru }
}

export function ubahStatusCreator(id, status) {
  if (!STATUS_CREATOR.includes(status)) {
    return { berhasil: false, pesan: `Status "${status}" tidak dikenal.` }
  }
  const baru = koleksi.perbarui(id, { status })
  if (!baru) return { berhasil: false, pesan: 'Creator tidak ditemukan.' }
  return { berhasil: true, data: baru }
}

export default {
  daftar: daftarCreator,
  ambil: ambilCreatorId,
  namaCreator: daftarNamaCreator,
  subscribe: subscribeCreator,
  subscribeCreator,
  tambah: tambahCreator,
  ubahStatus: ubahStatusCreator,
}
