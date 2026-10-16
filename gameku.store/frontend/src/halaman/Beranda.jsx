// Beranda Gamesku — hero slider + shortcut + 9 kategori + flash sale + populer + Streamku.
import { Link } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import BannerUtama from '../komponen/BannerUtama.jsx'
import Kategori from '../komponen/Kategori.jsx'
import BagianProduk from '../komponen/BagianProduk.jsx'
import FlashSale from '../komponen/FlashSale.jsx'
import Streamku from '../komponen/Streamku.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import Ikon from '../komponen/Ikon.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import {
  subscribeProduk,
  produkTersedia,
  produkTerbaru,
} from '../layanan/layananProduk.js'

const SHORTCUT = [
  { nama: 'Top Up', ikon: 'unduhCepat', ke: '/store' },
  { nama: 'Promo', ikon: 'promo', ke: '/promo' },
  { nama: 'Gratis', ikon: 'gratis', ke: '/gratis' },
  { nama: 'Bantuan', ikon: 'perisai', ke: '/bantuan' },
]

const keunggulan = [
  { ikon: 'unduhCepat', judul: 'Proses Instan', deskripsi: 'Pesanan diproses otomatis setelah bayar.' },
  { ikon: 'perisai', judul: 'Bayar Aman', deskripsi: 'Transaksi terenkripsi & mudah dilacak.' },
  { ikon: 'kreator', judul: 'Kreator Kurasi', deskripsi: 'Produk dipilih manual oleh tim.' },
  { ikon: 'promo', judul: 'Promo Mingguan', deskripsi: 'Diskon top-up & voucher favorit.' },
]

export default function Beranda() {
  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  const semua = produkTersedia()
  const promo = semua.filter((p) => p.hargaDiskon > 0 && p.hargaDiskon > p.harga)
  const terbaru = produkTerbaru(6)
  // Populer = produk diskon dulu, lalu sisanya.
  const populer = [...promo, ...semua.filter((p) => !(p.hargaDiskon > 0 && p.hargaDiskon > p.harga))].slice(0, 6)
  useReveal()

  return (
    <>
      <BannerUtama />
      <nav className="gk-short reveal" aria-label="Layanan Gamesku">
        {SHORTCUT.map((s) => (
          <Link key={s.nama} to={s.ke}><span className="ic"><Ikon nama={s.ikon} ukuran={19} /></span>{s.nama}</Link>
        ))}
      </nav>
      <Kategori />
      {semua.length === 0 && (
        <section className="bagian"><div className="wadah">
          <KeadaanKosong
            ikon="toko"
            judul="Katalog belum terisi"
            deskripsi="Produk Gamesku akan muncul di sini begitu admin menerbitkannya. Sementara itu, jelajahi kategori di atas."
            teksTombol="Lihat Kategori"
            tautanTombol="/kategori"
          />
        </div></section>
      )}
      <FlashSale daftar={promo} />
      <div className="reveal">
        <BagianProduk judul="Produk Populer" subjudul="Paling diburu pemain minggu ini." daftar={populer} tautan="/store" />
      </div>
      <Streamku />
      <div className="reveal">
        <BagianProduk judul="Rekomendasi Untukmu" subjudul="Rilisan terbaru dari kreator." daftar={terbaru} tautan="/store?urut=terbaru" />
      </div>
      <section className="bagian reveal"><div className="wadah">
        <div className="judul-bagian"><div><h2>Kenapa Gamesku?</h2><p>Cepat, aman, dan mobile-first.</p></div></div>
        <div className="kisi-unggul">
          {keunggulan.map((k) => (
            <article key={k.judul} className="kartu"><div className="kartu-isi kartu-unggul">
              <span className="ikon-unggul"><Ikon nama={k.ikon} ukuran={20} /></span>
              <strong>{k.judul}</strong><p>{k.deskripsi}</p>
            </div></article>
          ))}
        </div>
      </div></section>
    </>
  )
}


