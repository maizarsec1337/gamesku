// =====================================================================
// LAYANAN KATEGORI — daftar kategori produk Gamesku.
////
// MULAI KOSONG. Tidak ada kategori bawaan. Kategori dibuat sendiri oleh
// admin lewat halaman /admin/kategori, lalu langsung tersedia sebagai
// pilihan pada form Tambah Produk.
//
// Bentuk data sengaja meniru kolom tabel `kategori`:
//   id, nama, slug, deskripsi, ikon, gambar, status
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { catat } from './layananAktivitas.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_KATEGORI, jadikanSlug } from '../data/konstanta.js'

const koleksi = buatKoleksi('kategori', 'kat')

const kosongkan = () => ({
  nama: '',
  slug: '',
  deskripsi: '',
  ikon: 'kategori',
  gambar: '',
  status: STATUS_KATEGORI[0],
})

// Membersihkan input form dan menormalkan slug.
function normalisasi(data, bawaan = kosongkan()) {
  const nama = String(data.nama ?? bawaan.nama).trim()
  const slug = String(data.slug ?? '').trim() || jadikanSlug(nama)
  return {
    nama,
    slug,
    deskripsi: String(data.deskripsi ?? bawaan.deskripsi).trim(),
    ikon: data.ikon || bawaan.ikon || 'kategori',
    gambar: data.gambar ?? '',
    status: STATUS_KATEGORI.includes(data.status) ? data.status : STATUS_KATEGORI[0],
  }
}

// Menambah kategori baru.
export function tambahKategori(data) {
  const isi = normalisasi(data)
  if (!isi.nama) return { berhasil: false, pesan: 'Nama kategori wajib diisi.' }

  const bentrok = koleksi.daftar().find((k) => k.slug === isi.slug)
  if (bentrok) return { berhasil: false, pesan: `Slug "${isi.slug}" sudah dipakai kategori lain.` }

  const baru = koleksi.tambah(isi)
  catat({ teks: `Kategori "${isi.nama}" ditambahkan`, ikon: 'kategori', warna: 'biru' })
  return { berhasil: true, data: baru }
}

// Memperbarui kategori yang sudah ada.
export function perbaruiKategori(id, data) {
  const lama = koleksi.ambil(id)
  if (!lama) return { berhasil: false, pesan: 'Kategori tidak ditemukan.' }

  const isi = normalisasi(data, lama)
  if (!isi.nama) return { berhasil: false, pesan: 'Nama kategori wajib diisi.' }

  const bentrok = koleksi.daftar().find((k) => k.slug === isi.slug && k.id !== id)
  if (bentrok) return { berhasil: false, pesan: `Slug "${isi.slug}" sudah dipakai kategori lain.` }

  const baru = koleksi.perbarui(id, isi)
  catat({ teks: `Kategori "${isi.nama}" diperbarui`, ikon: 'edit', warna: 'biru' })
  return { berhasil: true, data: baru }
}

// Menghapus kategori. Mengembalikan { berhasil, pesan }.
export function hapusKategori(id) {
  const kategori = koleksi.ambil(id)
  if (!kategori) return { berhasil: false, pesan: 'Kategori tidak ditemukan.' }

  koleksi.hapus(id)
  catat({ teks: `Kategori "${kategori.nama}" dihapus`, ikon: 'hapus', warna: 'merah' })
  return { berhasil: true }
}

// ---------- Pembacaan ----------
//
// Dibiungkus memo() supaya referensinya stabil (syarat useSyncExternalStore).

export const daftarKategori = memo(() => koleksi.daftar())

export const ambilKategoriId = memo((id) => koleksi.ambil(id))

export const ambilKategoriSlug = memo((slug) => koleksi.ambil((k) => k.slug === slug))

// Hanya kategori aktif — dipakai form produk.
export const kategoriAktif = memo(() => daftarKategori().filter((k) => k.status === 'Aktif'))

// Nama kategori dari id (aman bila kategori sudah dihapus).
export const namaKategori = memo((id) => koleksi.ambil(id)?.nama || '')

// Berlangganan perubahan kategori.
export const subscribeKategori = (dengar) => koleksi.berlangganan(dengar)

export { kosongkan }

export default {
  daftar: daftarKategori,
  ambil: ambilKategoriId,
  ambilSlug: ambilKategoriSlug,
  aktif: kategoriAktif,
  namaKategori,
  subscribe: subscribeKategori,
  subscribeKategori,
  tambah: tambahKategori,
  perbarui: perbaruiKategori,
  hapus: hapusKategori,
  kosongkan,
}
