// Detail produk reusable — galeri + info beli + tab deskripsi.
// Data berasal dari layananProduk/layananKategori, bukan array contoh.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRupiah } from '../utilitas/format.js'
import { namaKategori } from '../layanan/layananKategori.js'
import { gradasiOtomatis } from '../data/konstanta.js'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import Ikon from './Ikon.jsx'
import '../css/detail.css'

export default function DetailProduk({ produk }) {
  const { tambahItem } = useKeranjang()
  const { disukai, alihkanSuka } = useWishlist()
  const [pesan, setPesan] = useState('')
  const suka = disukai(produk.id)

  const warna = gradasiOtomatis(produk.kategoriId)
  const kategori = namaKategori(produk.kategoriId)
  const persen =
    produk.hargaDiskon > 0
      ? Math.round((1 - produk.harga / produk.hargaDiskon) * 100)
      : 0

  // Simulasi frontend: masukkan ke keranjang lokal.
  const tambahkanKeKeranjang = () => {
    tambahItem({
      id: produk.id,
      nama: produk.nama,
      keterangan: `${kategori || produk.jenis} · ${produk.creator}`,
      harga: produk.harga,
      jumlah: 1,
    })
    setPesan('Produk ditambahkan ke keranjang.')
  }
  const beliSekarang = () => {
    tambahkanKeKeranjang()
    setPesan('Produk disiapkan ke keranjang. Checkout asli menyusul (tanpa pembayaran).')
  }

  return (
    <>
      <div className="tata-detail">
        <div>
          <div className="galeri-utama" style={{ background: `linear-gradient(135deg, ${warna[0]}, ${warna[1]})` }}>
            {String(produk.thumbnail || '').trim() ? (
              <img src={produk.thumbnail} alt={produk.nama} loading="lazy" decoding="async" width="800" height="500" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            ) : (
              <><span className="pola-kotak" aria-hidden="true" /><span className="ikon-besar" aria-hidden="true"><Ikon nama="toko" ukuran={56} /></span></>
            )}
            {persen > 0 && <span className="lencana lencana-kuning" style={{ position: 'absolute', top: 10, left: 10 }}>-{persen}%</span>}
          </div>
          <article className="kartu"><div className="kartu-isi">
            <h3>Deskripsi</h3>
            <p className="subjudul-halaman">
              {produk.deskripsiLengkap || produk.deskripsiSingkat || 'Deskripsi belum diisi.'}
            </p>
            {produk.versiMinecraft && (
              <p className="subjudul-halaman" style={{ marginTop: 8 }}>
                Versi Minecraft: {produk.versiMinecraft}.
              </p>
            )}
            {produk.thumbnail && (
              <p className="subjudul-halaman" style={{ marginTop: 8 }}>
                Thumbnail: {produk.thumbnail}
              </p>
            )}
            {produk.preview?.length > 0 && (
              <p className="subjudul-halaman" style={{ marginTop: 8 }}>
                Preview: {produk.preview.join(', ')}
              </p>
            )}
            {produk.fileProduk && (
              <p className="subjudul-halaman" style={{ marginTop: 8 }}>
                File produk: {produk.fileProduk}
              </p>
            )}
          </div></article>
        </div>

        <aside className="kartu"><div className="kartu-isi">
          <span className="lencana lencana-biru">{kategori || produk.jenis}</span>
          <h1 className="judul-produk">{produk.nama}</h1>
          <div className="meta-detail">
            {persen > 0 && <span>Diskon {persen}%</span>}
            <span>· oleh <strong>{produk.creator}</strong></span>
          </div>
          <div className="harga-detail">
            {produk.harga === 0 ? (
              <strong>Gratis</strong>
            ) : (
              <>
                <strong>{formatRupiah(produk.harga)}</strong>
                {produk.hargaDiskon > 0 && (
                  <span className="coret">{formatRupiah(produk.hargaDiskon)}</span>
                )}
              </>
            )}
          </div>
          <div className="aksi-detail">
            <button type="button" className="tombol tombol-utama" onClick={beliSekarang}><Ikon nama="unduhCepat" ukuran={17} />Beli Sekarang</button>
            <button type="button" className="tombol tombol-garis" onClick={tambahkanKeKeranjang}><Ikon nama="keranjang" ukuran={17} />Keranjang</button>
            <button type="button" className="tombol tombol-garis tombol-lebar-dua" onClick={() => alihkanSuka(produk.id)} aria-pressed={suka}><Ikon nama="hati" ukuran={17} />{suka ? 'Hapus Wishlist' : 'Tambah ke Wishlist'}</button>
          </div>
          {pesan && <p className="lencana lencana-biru" style={{ marginTop: 10 }}>{pesan}</p>}
          <div className="kartu-creator" style={{ marginTop: 14 }}>
            <span className="avatar-creator">{produk.creator.slice(0, 2).toUpperCase()}</span>
            <div><strong style={{ fontSize: 14 }}>{produk.creator}</strong><p className="subjudul-halaman" style={{ margin: 0 }}>Kreator Gamesku</p></div>
          </div>
          <Link className="tautan-lihat" style={{ marginTop: 10 }} to="/kategori">Lihat Semua Kategori<Ikon nama="panahKanan" ukuran={14} /></Link>
        </div></aside>
      </div>
    </>
  )
}
