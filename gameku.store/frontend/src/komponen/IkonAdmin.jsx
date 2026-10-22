// Ikon admin — dimuat malas HANYA di rute /admin via Ikon.jsx.
// Impor named statis agar tree-shakeable; chunk terpisah dari toko.
import {
  LayoutDashboard, Boxes, ShoppingBag, Users, Settings, Images,
  MessageSquare, Plus, Pencil, Trash2, LogOut, Wallet, ChevronDown,
  ChevronUp, TrendingUp, TrendingDown, Filter, Upload, Image as ImageIcon,
  Calendar, Clock, CircleCheck, CircleX, Tag, ChartColumn, CreditCard,
  Palette, Save, Lock, UserPlus, RefreshCw, Ellipsis, Puzzle, Package,
  Globe, KeyRound, CircleAlert, Box, Eye,
} from 'lucide-react'

const PETA = {
  dasbor: LayoutDashboard, kotak: Boxes, pesanan: ShoppingBag,
  pelanggan: Users, pengaturan: Settings, media: Images,
  ulasan: MessageSquare, tambah: Plus, edit: Pencil,
  hapus: Trash2, keluar: LogOut, dompet: Wallet,
  panahBawah: ChevronDown, panahAtas: ChevronUp, trenNaik: TrendingUp,
  trenTurun: TrendingDown, filter: Filter, unggah: Upload,
  gambar: ImageIcon, kalender: Calendar, jam: Clock,
  centangLingkaran: CircleCheck, silangLingkaran: CircleX,
  label: Tag, grafik: ChartColumn, kartu: CreditCard,
  palet: Palette, simpan: Save, gembok: Lock, tambahPengguna: UserPlus,
  muatUlang: RefreshCw, titikTiga: Ellipsis,
  sambung: Puzzle, berkas: Package, globe: Globe,
   kunci: KeyRound, peringatan: CircleAlert, lihat: Eye,
}

export default function IkonAdmin({ nama, ukuran = 18, tebal = 2, kelas = '' }) {
  const Komponen = PETA[nama] || Box
  return <Komponen size={ukuran} strokeWidth={tebal} className={kelas} aria-hidden="true" />
}
