// Kategori GameKU — grid 3x3 seragam. Data asli dari layanan;
// bila kosong, tampilkan 9 shortcut kurasi menuju rute yang memang ada.
import { Link } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { subscribeKategori, daftarKategori } from '../layanan/layananKategori.js'
import { subscribeProduk, daftarProduk } from '../layanan/layananProduk.js'
import Ikon from './Ikon.jsx'

const KURASI = [
  { nama: 'Top Games', ikon: 'toko', ke: '/store' },
  { nama: 'Promo', ikon: 'promo', ke: '/promo' },
  { nama: 'Gratis', ikon: 'gratis', ke: '/gratis' },
  { nama: 'Wishlist', ikon: 'hati', ke: '/wishlist' },
  { nama: 'Keranjang', ikon: 'keranjang', ke: '/keranjang' },
  { nama: 'Bantuan', ikon: 'perisai', ke: '/bantuan' },
  { nama: 'Kreator', ikon: 'kreator', ke: '/kreator' },
  { nama: 'Komunitas', ikon: 'pengguna', ke: '/komunitas' },
  { nama: 'StreamKU', ikon: 'unduhCepat', ke: '/berita' },
]

export default function Kategori({ ringkas = false }) {
  useSyncExternalStore(subscribeKategori, daftarKategori, daftarKategori)
  useSyncExternalStore(subscribeProduk, daftarProduk, daftarProduk)

  const kategori = daftarKategori()
  const produk = daftarProduk()

  return (
    <section className="bagian" style={{ paddingTop: 14 }}>
      <div className="wadah">
        {!ringkas && (
          <div className="judul-bagian">
            <div><h2>Jelajahi Kategori</h2><p>9 layanan terpopuler RAK VIN.</p></div>
            <Link className="tautan-lihat" to="/kategori">Semua →</Link>
          </div>
        )}
        {kategori.length > 0 ? (
          <div className="rel-kategori">
            {kategori.slice(0, 9).map((k) => (
              <Link key={k.id} className="kartu-kategori" to={`/kategori/${k.slug}`}>
                <span className="kategori-ikon" aria-hidden="true"><Ikon nama={k.ikon} ukuran={20} /></span>
                <strong>{k.nama}</strong>
                <small>{produk.filter((p) => p.kategoriId === k.id).length} produk</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rel-kategori">
            {KURASI.map((k) => (
              <Link key={k.nama} className="kartu-kategori" to={k.ke}>
                <span className="kategori-ikon" aria-hidden="true"><Ikon nama={k.ikon} ukuran={20} /></span>
                <strong>{k.nama}</strong>
                <small>RAK VIN</small>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

