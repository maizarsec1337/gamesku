// Halaman /gratis — semua konten gratis (dari layananProduk).
import { useSyncExternalStore } from 'react'
import BagianProduk from '../komponen/BagianProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import KeadaanKatalog from '../komponen/KeadaanKatalog.jsx'
import { subscribeProduk, produkGratis, statusProduk } from '../layanan/layananProduk.js'

export default function HalamanGratis() {
  useSyncExternalStore(subscribeProduk, produkGratis, produkGratis)
  const status = useSyncExternalStore(subscribeProduk, statusProduk, statusProduk)
  const daftar = produkGratis(20)

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-gratis">100% Gratis</span>
        <h1 className="judul-halaman">Konten Gratis</h1>
        <p className="subjudul-halaman">Unduh langsung tanpa bayar. Cocok untuk coba-coba sebelum upgrade premium.</p>
      </div></section>
      {status.memuat || status.galat ? <KeadaanKatalog status={status} /> : daftar.length === 0 ? (
        <section className="bagian"><div className="wadah">
          <KeadaanKosong
            judul="Belum ada konten gratis"
            deskripsi="Produk gratis Gamesku akan tampil di sini setelah admin menerbitkannya."
            teksTombol="Lihat Store"
            tautanTombol="/store"
          />
        </div></section>
      ) : (
        <BagianProduk judul="Semua yang Gratis" subjudul="Skin, map, dan modpack pembuka." daftar={daftar} />
      )}
    </>
  )
}
