import KosongAdmin from './KosongAdmin.jsx'
import ThumbnailProduk from './ThumbnailProduk.jsx'
import { formatAngka, formatRupiah } from '../../utilitas/format.js'
import { gradasiOtomatis } from '../../data/konstanta.js'

// =====================================================================
// Daftar peringkat produk terlaris.
//
// "peringkat" datang dari server (GET /api/dasbor → terlaris), dihitung
// dari pesanan berstatus Berhasil. Tanpa transaksi, kartu ini menampilkan
// "Belum ada produk." — bukan daftar dengan angka 0.
// =====================================================================
export default function KartuProdukTerlaris({ peringkat = [] }) {
  if (!peringkat.length) {
    return (
      <KosongAdmin
        ikon="kotak"
        judul="Belum ada produk."
        deskripsi="Peringkat penjualan muncul setelah ada transaksi."
      />
    )
  }

  return (
    <ul className="daftar-terlaris">
      {peringkat.map((p, i) => (
        <li key={p.nama} className="baris-terlaris">
          <span className="peringkat-terlaris">{p.peringkat}</span>
          <ThumbnailProduk
            nama={p.nama}
            warna={gradasiOtomatis(i)}
            ukuran={44}
            kelas="thumb-terlaris"
          />
          <span className="info-terlaris">
            <strong>{p.nama}</strong>
            <span>{formatAngka(p.terjual)} terjual</span>
          </span>
          <span className="angka-terlaris">
            <strong>{formatRupiah(p.pendapatan)}</strong>
          </span>
        </li>
      ))}
    </ul>
  )
}
