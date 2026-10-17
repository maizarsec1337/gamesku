// Konstanta Gamesku: pilihan nilai (dropdown, warna, label) — tanpa data contoh.

// Produk.

export const JENIS_PRODUK = [
  'Skin',
  'Skin Pack',
  'Map',
  'Texture Pack',
  'Add-on',
  'Mod',
  'Build',
  'Bundle',
]

export const STATUS_PRODUK = ['Draft', 'Aktif', 'Nonaktif']

// Kategori.

export const STATUS_KATEGORI = ['Aktif', 'Nonaktif']

// Pesanan.

export const STATUS_PESANAN = ['Menunggu', 'Diproses', 'Berhasil', 'Gagal']

// Promo.

export const STATUS_PROMO = ['Aktif', 'Terjadwal', 'Berakhir']

// Ulasan.

export const STATUS_ULASAN = ['Menunggu', 'Disetujui', 'Disembunyikan']

// Creator / pelanggan.

export const STATUS_CREATOR = ['Aktif', 'Review', 'Ditangguhkan']

export const STATUS_PELANGGAN = ['Aktif', 'Nonaktif']

// Ikon kategori (nama ikon lewat komponen Ikon).

export const IKON_KATEGORI = [
  'kategori',
  'kotak',
  'peta',
  'gambar',
  'sambung',
  'berkas',
  'pengaturan',
  'beranda',
  'kreator',
  'bintang',
  'promo',
  'perisai',
  'toko',
  'pelanggan',
  'pesanan',
  'media',
]

// Palet gradasi thumbnail; urutan dipilih otomatis, tidak terikat kategori.

export const PALET_GRADASI = [
  ['#43DDF5', '#BD54F5'],
  ['#BD54F5', '#F044D8'],
  ['#43DDF5', '#2A6BD6'],
  ['#F044D8', '#8A2BB8'],
  ['#5FE0F7', '#8A3FC4'],
  ['#43DDF5', '#F044D8'],
  ['#C77BF7', '#F044D8'],
  ['#16224A', '#43DDF5'],
]

const WARNA_CADANGAN = ['#43DDF5', '#BD54F5']

// Mengambil pasangan warna gradasi berdasarkan urutan (0 = warna pertama).
export function gradasiOtomatis(urutan = 0) {
  return PALET_GRADASI[Math.abs(Number(urutan) || 0) % PALET_GRADASI.length]
}

// Mengubah nilai warna menjadi string CSS linear-gradient.
export function gayaGradasi(warna) {
  const [a, b] = Array.isArray(warna) && warna.length === 2 ? warna : WARNA_CADANGAN
  return `linear-gradient(135deg, ${a}, ${b})`
}

// ---------- Utility tampilan ----------

// Mengubah teks bebas menjadi slug URL (a-z, 0-9, tanda hubung).
export function jadikanSlug(teks) {
  return String(teks || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Format ringkas untuk label metastasis: "3 menit lalu".
export function waktuRelatif(iso) {
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return '-'
  const detik = Math.floor((Date.now() - tanggal.getTime()) / 1000)
  if (detik < 60) return 'Baru saja'
  const menit = Math.floor(detik / 60)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 30) return `${hari} hari lalu`
  return tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
