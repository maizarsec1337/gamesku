// Halaman /promo — produk yang sedang diskon (dari layananProduk).
// Tidak ada spanduk promo statis: promo berasal dari data produk nyata.
import { useSyncExternalStore } from 'react'
import BagianProduk from '../komponen/BagianProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import { subscribeProduk, produkTersedia } from '../layanan/layananProduk.js'
import '../css/beranda.css'

export default function HalamanPromo() {
  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)

  // Hanya produk yang benar-benar punya harga coret.
  const daftarPromo = produkTersedia().filter(
    (p) => p.hargaDiskon > 0 && p.hargaDiskon > p.harga,
  )

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-kuning">Promo Terbatas</span>
        <h1 className="judul-halaman">Promo Minggu Ini</h1>
        <p className="subjudul-halaman">Diskon kreator pilihan. Harga kembali normal tanpa pemberitahuan.</p>
      </div></section>
      {daftarPromo.length === 0 ? (
        <section className="bagian"><div className="wadah">
          <KeadaanKosong
            judul="Belum ada promo"
            deskripsi="Promo Gamesku akan tampil di sini setelah admin membuat diskon."
            teksTombol="Lihat Store"
            tautanTombol="/store"
          />
        </div></section>
      ) : (
        <BagianProduk
          judul="Semua Promo"
          subjudul={`${daftarPromo.length} produk sedang diskon.`}
          daftar={daftarPromo}
          tautan="/store"
        />
      )}
    </>
  )
}
