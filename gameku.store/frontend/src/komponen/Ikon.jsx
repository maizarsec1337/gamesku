// Ikon — impor named statis dari lucide-react agar tree-shakeable.
// HANYA ikon di bawah yang masuk bundle. Jangan tambah tanpa kebutuhan.
// Ikon toko (dipakai halaman publik + home):
import {
  Home, Store, LayoutGrid, Gift, BadgePercent, Search, ShoppingCart,
  User, Heart, Star, Download, Zap, ShieldCheck, PenTool, Box,
  ArrowRight, ArrowLeft, X, Check, Menu, Bell, Eye, EyeOff, Info, Map,
} from 'lucide-react'
// Ikon admin (dipakai di rute /admin saja — diimpor malas via IkonAdmin):
import { Suspense, lazy } from 'react'

const IkonAdmin = lazy(() => import('./IkonAdmin.jsx'))

const PETA_TOKO = {
  beranda: Home, toko: Store, kategori: LayoutGrid, gratis: Gift,
  promo: BadgePercent, cari: Search, keranjang: ShoppingCart,
  pengguna: User, hati: Heart, bintang: Star, unduh: Download,
  unduhCepat: Zap, perisai: ShieldCheck, kreator: PenTool, cubus: Box,
  panahKanan: ArrowRight, panahKiri: ArrowLeft, tutup: X, cek: Check,
  menu: Menu, lonceng: Bell, lihat: Eye, mataTutup: EyeOff, info: Info,
  peta: Map,
}

const IKON_ADMIN = new Set([
  'dasbor', 'kotak', 'pesanan', 'pelanggan', 'pengaturan', 'media',
  'ulasan', 'tambah', 'edit', 'hapus', 'keluar', 'dompet',
  'panahBawah', 'panahAtas', 'trenNaik', 'trenTurun', 'filter', 'unggah',
  'gambar', 'kalender', 'jam', 'centangLingkaran', 'silangLingkaran',
  'label', 'grafik', 'kartu', 'palet', 'simpan', 'gembok', 'tambahPengguna',
  'muatUlang', 'titikTiga', 'sambung', 'berkas', 'globe', 'kunci', 'peringatan',
])

const petaFallback = {
  beranda: '⌂', toko: '▦', kategori: '▤', gratis: '♡', promo: '✦',
  cari: '⌕', keranjang: '○', pengguna: '○', hati: '♡', bintang: '★',
  unduh: '↓', unduhCepat: '⚡', perisai: '⛨', kreator: '✎', cubus: '▦',
  panahKanan: '→', panahKiri: '←', tutup: '✕', cek: '✓', menu: '☰',
  lonceng: '○', lihat: '○', mataTutup: '○', info: 'ⓘ', peta: '⌖',
}

function IkonFallback({ nama, ukuran }) {
  return (
    <span className="ikon-fallback" style={{ fontSize: ukuran }} aria-hidden="true">
      {petaFallback[nama] || '▦'}
    </span>
  )
}

export default function Ikon({ nama = 'cubus', ukuran = 18, tebal = 2, kelas = '' }) {
  // Ikon admin dimuat malas agar tidak membebani halaman toko.
  if (IKON_ADMIN.has(nama)) {
    return (
      <Suspense fallback={<IkonFallback nama={nama} ukuran={ukuran} />}>
        <IkonAdmin nama={nama} ukuran={ukuran} tebal={tebal} kelas={kelas} />
      </Suspense>
    )
  }
  const Komponen = PETA_TOKO[nama] || Box
  return <Komponen size={ukuran} strokeWidth={tebal} className={kelas} aria-hidden="true" />
}


