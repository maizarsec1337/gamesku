// Kategori Gamesku — grid seragam. Data asli dari layanan;
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
  { nama: 'Streamku', ikon: 'siaran', ke: '/streamku' },
]

export default function Kategori({ ringkas = false }) {
  useSyncExternalStore(subscribeKategori, daftarKategori, daftarKategori)
  useSyncExternalStore(subscribeProduk, daftarProduk, daftarProduk)

  const kategori = daftarKategori()
  const produk = daftarProduk()
  const isi = kategori.length > 0
    ? kategori.slice(0, 9).map((k) => ({
      kunci: k.id,
      nama: k.nama,
      ikon: k.ikon,
      ke: `/kategori/${k.slug}`,
      jumlah: produk.filter((p) => p.kategoriId === k.id).length,
    }))
    : KURASI.map((k) => ({ kunci: k.nama, nama: k.nama, ikon: k.ikon, ke: k.ke, jumlah: null }))

  return (
    <section className="bagian" aria-label="Kategori">
      <div className="wadah">
        {!ringkas && (
          <div className="judul-bagian">
            <div><h2>Jelajahi Kategori</h2><p>{isi.length} layanan terpopuler Gamesku.</p></div>
            <Link className="tautan-lihat" to="/kategori">Semua<Ikon nama="panahKanan" ukuran={14} /></Link>
          </div>
        )}
        <div className="rel-kategori">
          {isi.map((k) => (
            <Link key={k.kunci} className="kartu-jelajah" to={k.ke}>
              <span className="kategori-ikon" aria-hidden="true"><Ikon nama={k.ikon} ukuran={20} /></span>
              <span className="kategori-teks">
                <strong>{k.nama}</strong>
                <small>{k.jumlah === null ? 'Gamesku' : `${k.jumlah} produk`}</small>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
