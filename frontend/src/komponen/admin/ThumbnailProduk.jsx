// Thumbnail gradasi berinisial — pengganti gambar (produk belum punya aset).
export default function ThumbnailProduk({
  nama = '?',
  warna,
  ukuran = 42,
  kelas = 'thumb-kecil',
}) {
  const inisial = String(nama).trim().charAt(0).toUpperCase() || '?'
  const [a, b] = Array.isArray(warna) && warna.length === 2
    ? warna
    : ['#5a6b7d', '#2f3944']

  return (
    <span
      className={kelas}
      style={{
        width: ukuran,
        height: ukuran,
        fontSize: Math.round(ukuran * 0.38),
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
      aria-hidden="true"
    >
      {inisial}
    </span>
  )
}
