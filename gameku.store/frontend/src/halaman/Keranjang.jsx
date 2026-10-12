// Halaman /keranjang — UI keranjang frontend (tanpa payment nyata).
import { Link } from 'react-router-dom'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import { formatRupiah } from '../utilitas/format.js'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import Ikon from '../komponen/Ikon.jsx'

export default function HalamanKeranjang() {
  const { daftarItem, hapusItem, ubahJumlah, subtotal, jumlahItem, kosongkanKeranjang } = useKeranjang()

  if (!daftarItem.length) {
    return (
      <section className="bagian"><div className="wadah">
        <KeadaanKosong ikon="keranjang" judul="Keranjang masih kosong" deskripsi="Jelajahi RAK VIN dan tambahkan top-up atau item favoritmu." teksTombol="Jelajahi RAK VIN" tautanTombol="/store" />
      </div></section>
    )
  }

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <h1 className="judul-halaman">Keranjang ({jumlahItem})</h1>
        <p className="subjudul-halaman">Periksa item RAK VIN sebelum lanjut.</p>
      </div></section>
      <section className="bagian"><div className="wadah tata-detail">
        <div style={{ display: 'grid', gap: 10 }}>
          {daftarItem.map((item) => (
            <article key={item.id} className="kartu"><div className="kartu-isi" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="avatar-creator" aria-hidden="true"><Ikon nama="toko" ukuran={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 14 }}>{item.nama}</strong>
                <p className="subjudul-halaman" style={{ margin: 0 }}>{item.keterangan}</p>
                <strong style={{ color: '#1D4ED8' }}>{formatRupiah(item.harga * item.jumlah)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" className="tombol-ikon" aria-label="Kurangi" onClick={() => ubahJumlah(item.id, item.jumlah - 1)}>−</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{item.jumlah}</span>
                <button type="button" className="tombol-ikon" aria-label="Tambah" onClick={() => ubahJumlah(item.id, item.jumlah + 1)}>+</button>
              </div>
              <button type="button" className="tombol-ikon" aria-label={`Hapus ${item.nama}`} onClick={() => hapusItem(item.id)}><Ikon nama="tutup" ukuran={16} /></button>
            </div></article>
          ))}
          <button type="button" className="tautan-lihat" onClick={kosongkanKeranjang}>Kosongkan keranjang</button>
        </div>
        <aside className="kartu"><div className="kartu-isi">
          <h3>Ringkasan</h3>
          <p className="subjudul-halaman">{jumlahItem} item · Subtotal {formatRupiah(subtotal)}</p>
          <button type="button" className="tombol tombol-utama tombol-lebar" style={{ marginTop: 12 }} disabled>Checkout</button>
          <Link className="tombol tombol-garis tombol-lebar" style={{ marginTop: 8 }} to="/store">Lanjut Belanja</Link>
        </div></aside>
      </div></section>
    </>
  )
}
