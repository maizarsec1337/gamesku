// Kartu produk Gamesku — thumbnail proporsional + badge kuning + CTA cepat.
import { Link } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { formatRupiah } from '../utilitas/format.js'
import { namaKategori } from '../layanan/layananKategori.js'
import { subscribeProduk, daftarProduk } from '../layanan/layananProduk.js'
import { gradasiOtomatis } from '../data/konstanta.js'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import Ikon from './Ikon.jsx'

export default function KartuProduk({ produk, modeFlash = false }) {
  const { disukai, alihkanSuka } = useWishlist()
  const { tambahItem } = useKeranjang()
  useSyncExternalStore(subscribeProduk, daftarProduk, daftarProduk)

  const suka = disukai(produk.id)
  const warna = gradasiOtomatis(produk.kategoriId)
  const persen = produk.hargaDiskon > 0 ? Math.round((1 - produk.harga / produk.hargaDiskon) * 100) : 0
  const thumb = String(produk.thumbnail || '').trim()

  const tambahCepat = () => {
    tambahItem({ id: produk.id, nama: produk.nama, keterangan: namaKategori(produk.kategoriId) || produk.jenis, harga: produk.harga, jumlah: 1 })
  }

  const gambar = thumb ? (
    <img src={thumb} alt={produk.nama} loading="lazy" decoding="async" width="300" height="300" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <>
      <span className="pola-kotak" aria-hidden="true" />
      <span className="ikon-besar" aria-hidden="true"><Ikon nama="toko" ukuran={42} /></span>
    </>
  )

  if (modeFlash) {
    return (
      <article className="flash-card">
        <Link className="img" to={`/produk/${produk.slug}`} style={{ background: `linear-gradient(135deg, ${warna[0]}, ${warna[1]})` }} aria-label={produk.nama}>
          {thumb ? <img src={thumb} alt={produk.nama} loading="lazy" decoding="async" width="272" height="168" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden="true"><Ikon nama="toko" ukuran={30} /></span>}
          {persen > 0 && <span className="diskon">-{persen}%</span>}
        </Link>
        <div className="bd">
          <p className="nm">{produk.nama}</p>
          <p className="hg">{produk.harga === 0 ? 'Gratis' : formatRupiah(produk.harga)}</p>
          {produk.hargaDiskon > 0 && <p className="cr">{formatRupiah(produk.hargaDiskon)}</p>}
          <button type="button" className="cta-mini" onClick={tambahCepat}>+ Keranjang</button>
        </div>
      </article>
    )
  }

  return (
    <article className="kartu-produk">
      <Link className="gambar-produk" to={`/produk/${produk.slug}`} style={{ background: `linear-gradient(135deg, ${warna[0]}, ${warna[1]})` }} aria-label={produk.nama}>
        {gambar}
        <span className="baris-badge">
          {produk.harga === 0 ? <span className="lencana lencana-gratis">Gratis</span> : persen > 0 && <span className="lencana lencana-merah">-{persen}%</span>}
        </span>
      </Link>
      <button type="button" className={suka ? 'tombol-suka aktif' : 'tombol-suka'} onClick={() => alihkanSuka(produk.id)} aria-label={suka ? `Hapus ${produk.nama} dari wishlist` : `Simpan ${produk.nama} ke wishlist`} aria-pressed={suka}>
        <Ikon nama="hati" ukuran={16} />
      </button>
      <div className="badan-produk">
        <span className="kategori-produk">{namaKategori(produk.kategoriId) || produk.jenis}</span>
        <Link className="nama-produk" to={`/produk/${produk.slug}`}>{produk.nama}</Link>
        <div className="harga-produk">
          {produk.harga === 0 ? <span className="harga-gratis">Gratis</span> : (<><strong>{formatRupiah(produk.harga)}</strong>{produk.hargaDiskon > 0 && <span className="coret">{formatRupiah(produk.hargaDiskon)}</span>}</>)}
        </div>
        <button type="button" className="tambah-kecil" onClick={tambahCepat} aria-label={`Tambah ${produk.nama} ke keranjang`}><Ikon nama="keranjang" ukuran={14} /> Keranjang</button>
      </div>
    </article>
  )
}

