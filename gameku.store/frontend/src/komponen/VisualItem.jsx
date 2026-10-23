import { Shirt, Map, Boxes, Palette, Gamepad2 } from 'lucide-react'

// Ilustrasi cadangan mengikuti jenis item ketika kreator belum mengunggah gambar.
export default function VisualItem({ jenis, ukuran = 48 }) {
  const Simbol = { Skin: Shirt, 'Skin Pack': Shirt, Map, Build: Boxes, Bundle: Boxes,
    'Texture Pack': Palette, 'Add-on': Boxes, Mod: Gamepad2 }[jenis] || Gamepad2
  return <Simbol size={ukuran} strokeWidth={1.3} aria-hidden="true" />
}
