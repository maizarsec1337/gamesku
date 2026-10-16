// Layanan produk: katalog produk Gamesku (mulai kosong, diisi admin).

import { buatKoleksi } from './layananKoleksi.js'
import { catat } from './layananAktivitas.js'
import { memo } from './penyimpananLokal.js'
import { JENIS_PRODUK, STATUS_PRODUK, jadikanSlug } from '../data/konstanta.js'

const koleksi = buatKoleksi('produk', 'prd')

// Bentuk form kosong untuk form Tambah/Edit Produk.
export const formKosong = () => ({
  nama: '',
  slug: '',
  kategoriId: '',
  jenis: JENIS_PRODUK[0],
  deskripsiSingkat: '',
  deskripsiLengkap: '',
  harga: 0,
  hargaDiskon: 0,
  thumbnail: '',
  preview: [],
  fileProduk: '',
  versiMinecraft: '',
  creator: '',
  status: 'Draft',
})

// Membersihkan input form. Angka dirapikan, slug dilengkapi otomatis.
function normalisasi(data, bawaan = formKosong()) {
  const nama = String(data.nama ?? bawaan.nama ?? '').trim()
  const slug = String(data.slug ?? '').trim() || jadikanSlug(nama)
  const harga = Math.max(0, Number(data.harga ?? 0) || 0)
  const hargaDiskon = Math.max(0, Number(data.hargaDiskon ?? 0) || 0)

  return {
    nama,
    slug,
    kategoriId: data.kategoriId ?? '',
    jenis: JENIS_PRODUK.includes(data.jenis) ? data.jenis : (bawaan.jenis || JENIS_PRODUK[0]),
    deskripsiSingkat: String(data.deskripsiSingkat ?? '').trim(),
    deskripsiLengkap: String(data.deskripsiLengkap ?? '').trim(),
    harga,
    // Harga coret hanya sah bila lebih besar dari harga jual.
    hargaDiskon: hargaDiskon > harga ? hargaDiskon : 0,
    thumbnail: data.thumbnail ?? '',
    preview: Array.isArray(data.preview) ? data.preview : [],
    fileProduk: data.fileProduk ?? '',
    versiMinecraft: String(data.versiMinecraft ?? '').trim(),
    creator: String(data.creator ?? '').trim(),
    status: STATUS_PRODUK.includes(data.status) ? data.status : 'Draft',
  }
}

// Validasi wajib isi form produk.
function validasi(isi) {
  if (!isi.nama) return 'Nama produk wajib diisi.'
  if (!isi.kategoriId) return 'Kategori wajib dipilih.'
  if (!isi.creator) return 'Creator wajib diisi.'
  return ''
}



// Menambah produk baru.
export function tambahProduk(data) {
  const isi = normalisasi(data)
  const galat = validasi(isi)
  if (galat) return { berhasil: false, pesan: galat }

  const bentrok = koleksi.daftar().find((p) => p.slug === isi.slug)
  if (bentrok) return { berhasil: false, pesan: `Slug "${isi.slug}" sudah dipakai produk lain.` }

  const baru = koleksi.tambah(isi)
  catat({ teks: `Produk "${isi.nama}" disimpan sebagai ${isi.status}`, ikon: 'kotak', warna: 'hijau' })
  return { berhasil: true, data: baru }
}

// Memperbarui produk yang sudah ada.
export function perbaruiProduk(id, data) {
  const lama = koleksi.ambil(id)
  if (!lama) return { berhasil: false, pesan: 'Produk tidak ditemukan.' }

  const isi = normalisasi(data, lama)
  const galat = validasi(isi)
  if (galat) return { berhasil: false, pesan: galat }

  const bentrok = koleksi.daftar().find((p) => p.slug === isi.slug && p.id !== id)
  if (bentrok) return { berhasil: false, pesan: `Slug "${isi.slug}" sudah dipakai produk lain.` }

  const baru = koleksi.perbarui(id, isi)
  catat({ teks: `Produk "${isi.nama}" diperbarui`, ikon: 'edit', warna: 'hijau' })
  return { berhasil: true, data: baru }
}

// Menghapus produk.
export function hapusProduk(id) {
  const produk = koleksi.ambil(id)
  if (!produk) return { berhasil: false, pesan: 'Produk tidak ditemukan.' }

  koleksi.hapus(id)
  catat({ teks: `Produk "${produk.nama}" dihapus`, ikon: 'hapus', warna: 'merah' })
  return { berhasil: true }
}

// Mengubah status produk (Draft / Aktif / Nonaktif).
export function ubahStatusProduk(id, status) {
  if (!STATUS_PRODUK.includes(status)) {
    return { berhasil: false, pesan: `Status "${status}" tidak dikenal.` }
  }
  const baru = koleksi.perbarui(id, { status })
  if (!baru) return { berhasil: false, pesan: 'Produk tidak ditemukan.' }

  catat({ teks: `Status produk "${baru.nama}" diubah ke ${status}`, ikon: 'label', warna: 'biru' })
  return { berhasil: true, data: baru }
}


// Fungsi pembaca dibungkus memo() agar referensi stabil
// (syarat useSyncExternalStore — cegah render tak berujung).

export const daftarProduk = memo(() => koleksi.daftar())

export const ambilProdukId = memo((id) => koleksi.ambil(id))

export const ambilProdukSlug = memo((slug) => koleksi.ambil((p) => p.slug === slug))

// Produk yang siap tampil di toko (hanya status Aktif).
export const produkTersedia = memo(() => daftarProduk().filter((p) => p.status === 'Aktif'))

export const produkGratis = memo((jumlah) => {
  const semua = produkTersedia().filter((p) => p.harga === 0)
  return jumlah ? semua.slice(0, jumlah) : semua
})

// Rilisan terbaru berdasarkan waktu simpan.
export const produkTerbaru = memo((jumlah = 8) =>
  [...produkTersedia()]
    .sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
    .slice(0, jumlah),
)

// Pencarian pada kolom nama, creator, dan slug.
export const cariProduk = memo((kataKunci) => {
  const kunci = String(kataKunci || '').trim().toLowerCase()
  if (!kunci) return produkTersedia()
  return produkTersedia().filter((p) =>
    `${p.nama} ${p.creator} ${p.slug}`.toLowerCase().includes(kunci),
  )
})

// Mengurutkan daftar produk.
export const urutkanProduk = memo((daftar, mode = 'terbaru') => {
  const salin = [...daftar]
  if (mode === 'harga-rendah') salin.sort((a, b) => a.harga - b.harga)
  else if (mode === 'harga-tinggi') salin.sort((a, b) => b.harga - a.harga)
  else if (mode === 'nama') salin.sort((a, b) => a.nama.localeCompare(b.nama))
  else salin.sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
  return salin
})

// Produk lain, kategori sama diutamakan.
export const produkTerkait = memo((produk, jumlah = 4) => {
  if (!produk) return []
  return produkTersedia()
    .filter((p) => p.id !== produk.id)
    .sort(
      (a, b) =>
        Number(b.kategoriId === produk.kategoriId) - Number(a.kategoriId === produk.kategoriId),
    )
    .slice(0, jumlah)
})

// Jumlah produk pada satu kategori.
export const jumlahProdukPerKategori = memo(
  (kategoriId) => daftarProduk().filter((p) => p.kategoriId === kategoriId).length,
)

// Berlangganan perubahan katalog (dipakai komponen yang menuruni thread).
export const subscribeProduk = (dengar) => koleksi.berlangganan(dengar)

export default {
  daftar: daftarProduk,
  ambil: ambilProdukId,
  ambilSlug: ambilProdukSlug,
  subscribe: subscribeProduk,
  tersedia: produkTersedia,
  gratis: produkGratis,
  terbaru: produkTerbaru,
  cari: cariProduk,
  urutkan: urutkanProduk,
  terkait: produkTerkait,
  jumlahPerKategori: jumlahProdukPerKategori,
  tambah: tambahProduk,
  perbarui: perbaruiProduk,
  hapus: hapusProduk,
  ubahStatus: ubahStatusProduk,
  formKosong,
}
