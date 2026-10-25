// =====================================================================
// PANDUAN CHATBOT — jawaban statis yang JUJUR (bukan AI).
//
// Dipakai HANYA saat asisten AI belum tersambung (VITE_CHAT_ENDPOINT
// belum diisi). Isinya mengarahkan pengguna ke halaman/fitur Gamesku
// yang memang ada. TIDAK ada produk, harga, stok, atau katalog karangan:
// semua tautan menuju rute nyata, dan data produk selalu dari layanan.
//
// Begitu endpoint AI resmi tersedia, mode ini otomatis tidak dipakai.
// =====================================================================

export const sapaanPanduan =
  'Halo! Asisten AI Gamesku belum tersambung, jadi saya tampilkan panduan singkat. Pilih topik di bawah atau ketik pertanyaan.'

export const saranTopik = [
  { id: 'beli', label: 'Cara beli produk' },
  { id: 'cari', label: 'Cari produk' },
  { id: 'promo', label: 'Promo & diskon' },
  { id: 'akun', label: 'Akun & masuk' },
  { id: 'kontak', label: 'Bantuan & kontak' },
]

// Setiap entri: kata kunci pencocokan, judul, jawaban jujur, dan tautan
// aplikasi yang benar-benar ada. Tautan diisi rute internal router.
const panduan = [
  {
    id: 'beli',
    kunci: ['beli', 'bayar', 'checkout', 'pesan', 'cara', 'transaksi', 'order'],
    judul: 'Cara membeli produk',
    jawab: 'Buka halaman Store, pilih produk, lalu lihat detailnya. Tekan "Tambah ke Keranjang" untuk menyiapkan item. Checkout pembayaran belum aktif karena belum tersambung ke payment gateway — alur ini akan tersedia setelah integrasi backend.',
    tautan: { ke: '/store', label: 'Buka Store' },
  },
  {
    id: 'cari',
    kunci: ['cari', 'temukan', 'produk', 'katalog', 'item', 'skin', 'map', 'voucher', 'top up', 'topup'],
    judul: 'Mencari produk',
    jawab: 'Gunakan kolom pencarian di Store atau Kategori, lalu saring per kategori. Daftar produk selalu berasal dari katalog resmi, jadi jika belum ada produk yang tampil berarti admin belum menerbitkannya.',
    tautan: { ke: '/store', label: 'Cari di Store' },
  },
  {
    id: 'promo',
    kunci: ['promo', 'diskon', 'potongan', 'murah', 'sale'],
    judul: 'Promo & diskon',
    jawab: 'Halaman Promo menampilkan produk yang benar-benar punya harga coret. Jika halaman kosong, berarti belum ada promo aktif dari admin.',
    tautan: { ke: '/promo', label: 'Lihat Promo' },
  },
  {
    id: 'gratis',
    kunci: ['gratis', 'free', 'tanpa bayar'],
    judul: 'Konten gratis',
    jawab: 'Produk berharga Rp0 ada di halaman Konten Gratis. Isinya mengikuti katalog resmi dari admin.',
    tautan: { ke: '/gratis', label: 'Lihat Konten Gratis' },
  },
  {
    id: 'wishlist',
    kunci: ['wishlist', 'simpan', 'favorit', 'hati'],
    judul: 'Wishlist',
    jawab: 'Tekan ikon hati pada kartu produk untuk menyimpannya. Daftar tersimpan di browser ini dan bisa dibuka kapan saja.',
    tautan: { ke: '/wishlist', label: 'Buka Wishlist' },
  },
  {
    id: 'keranjang',
    kunci: ['keranjang', 'cart', 'belanja'],
    judul: 'Keranjang',
    jawab: 'Item yang ditambahkan akan muncul di Keranjang. Di sana kamu bisa mengubah jumlah atau menghapus item.',
    tautan: { ke: '/keranjang', label: 'Buka Keranjang' },
  },
  {
    id: 'akun',
    kunci: ['akun', 'masuk', 'login', 'daftar', 'registrasi', 'profil', 'sandi'],
    judul: 'Akun & masuk',
    jawab: 'Halaman Masuk menyediakan mode Masuk dan Daftar. Pendaftaran pembeli tersimpan di browser ini; sesi login pembeli menunggu endpoint backend. Profil menampilkan ringkasan wishlist dan keranjang.',
    tautan: { ke: '/masuk', label: 'Buka Halaman Masuk' },
  },
  {
    id: 'streamku',
    kunci: ['streamku', 'video', 'tonton', 'siaran'],
    judul: 'Streamku',
    jawab: 'Streamku adalah ruang video gaming Gamesku. Daftar video tampil setelah API video resmi dihubungkan.',
    tautan: { ke: '/streamku', label: 'Buka Streamku' },
  },
  {
    id: 'kontak',
    kunci: ['bantuan', 'kontak', 'hubungi', 'discord', 'support', 'kendala', 'error', 'masalah', 'refund'],
    judul: 'Bantuan & kontak',
    jawab: 'Pusat Bantuan berisi pertanyaan umum. Untuk ngobrol langsung, komunitas Discord Gamesku adalah kanal resminya.',
    tautan: { ke: '/bantuan', label: 'Pusat Bantuan' },
  },
]

// Mencocokkan teks bebas ke satu entri panduan (paling banyak cocok).
export function cariPanduan(teks) {
  const tanya = String(teks || '').toLowerCase().trim()
  if (!tanya) return null
  let terbaik = null
  let skorTerbaik = 0
  for (const item of panduan) {
    let skor = 0
    for (const kunci of item.kunci) if (tanya.includes(kunci)) skor += 1
    if (skor > skorTerbaik) {
      skorTerbaik = skor
      terbaik = item
    }
  }
  return terbaik
}

export function ambilPanduan(id) {
  if (id === 'akun' || id === 'kontak' || id === 'beli' || id === 'cari' || id === 'promo') {
    const dariTopik = saranTopik.find((t) => t.id === id)
    const item = panduan.find((p) => p.id === id) || null
    if (item) return { ...item, label: dariTopik?.label || item.judul }
  }
  return panduan.find((p) => p.id === id) || null
}

// Pesan saat pertanyaan tidak dikenali (mode panduan).
export const pesanTidakDikenal =
  'Saya belum bisa menjawab itu karena asisten AI belum tersambung. Coba pilih salah satu topik di bawah, atau buka Pusat Bantuan.'
