import TabelData from './TabelData.jsx'
import LencanaStatus from './LencanaStatus.jsx'
import KosongAdmin from './KosongAdmin.jsx'
import { formatRupiah } from '../../utilitas/format.js'

// Kolom tetap tabel pesanan (dasbor & halaman /admin/pesanan).
const kolomPesanan = [
  {
    kunci: 'id',
    label: 'ID',
    render: (p) => <span className="id-pesanan">{p.id}</span>,
  },
  {
    kunci: 'pelanggan',
    label: 'Pelanggan',
    render: (p) => (
      <span className="sel-produk">
        <span className="avatar-kecil">{(p.pelanggan || '?').charAt(0)}</span>
        <span className="sel-produk-teks">
          <strong>{p.pelanggan}</strong>
        </span>
      </span>
    ),
  },
  { kunci: 'produk', label: 'Produk' },
  {
    kunci: 'kategori',
    label: 'Kategori',
    render: (p) => <span className="kategori-pill">{p.kategori || '—'}</span>,
  },
  {
    kunci: 'tanggal',
    label: 'Tanggal',
    render: (p) => <span className="teks-redup">{p.tanggal || p.dibuatPada || '—'}</span>,
  },
  {
    kunci: 'total',
    label: 'Total',
    rata: 'sel-kanan',
    render: (p) => (
      <span className="nominal">{Number(p.total) === 0 ? 'Gratis' : formatRupiah(p.total)}</span>
    ),
  },
  {
    kunci: 'status',
    label: 'Status',
    render: (p) => <LencanaStatus status={p.status} />,
  },
]

// Tabel pesanan reusable (klik baris → detail bila ada "padaLihat").
// Tanpa pesanan sama sekali, tampil empty state lengkap dengan CTA.
export default function TabelPesanan({ pesanan = [], padaLihat, kosong }) {
  if (!pesanan.length && kosong) return kosong

  return (
    <TabelData
      kolom={kolomPesanan}
      baris={pesanan}
      padaKlikBaris={padaLihat}
      pesanKosong="Belum ada pesanan pada filter ini."
    />
  )
}

export { KosongAdmin }
