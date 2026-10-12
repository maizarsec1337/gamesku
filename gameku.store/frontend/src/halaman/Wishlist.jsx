// Halaman /wishlist — produk yang disimpan lewat KonteksWishlist.
import { useMemo, useSyncExternalStore } from 'react'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { daftarProduk, subscribeProduk } from '../layanan/layananProduk.js'
import KartuProduk from '../komponen/KartuProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'

export default function HalamanWishlist() {
  const { daftarSuka, jumlahSuka } = useWishlist()

  // Berlangganan seluruh katalog. CATATAN: jangan menamai variabel lokal
  // ini "daftarProduk" — akan menutupi import dan memicu TDZ error.
  const katalog = useSyncExternalStore(subscribeProduk, daftarProduk, daftarProduk)

  const produk = useMemo(
    () => daftarSuka.map((id) => katalog.find((p) => p.id === id)).filter(Boolean),
    [daftarSuka, katalog],
  )

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Wishlist</span>
        <h1 className="judul-halaman">Wishlist Saya</h1>
        <p className="subjudul-halaman">
          {jumlahSuka} produk tersimpan di RAK VIN.
        </p>
      </div></section>
      <section className="bagian"><div className="wadah">
        {produk.length === 0 ? (
          <KeadaanKosong
            judul="Wishlist masih kosong"
            deskripsi="Ketuk ikon hati pada kartu produk untuk menyimpan top-up favoritmu di RAK VIN."
            teksTombol="Jelajahi Store"
            tautanTombol="/store"
          />
        ) : (
          <div className="kisi-produk">
            {produk.map((item) => (<KartuProduk key={item.id} produk={item} />))}
          </div>
        )}
      </div></section>
    </>
  )
}
