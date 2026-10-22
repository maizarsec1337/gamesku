// Halaman /produk/:slug — layout 2 kolom desktop, 1 kolom mobile.
import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import {
  ambilProdukSlug,
  produkTerkait,
  subscribeProduk,
  statusProduk,
} from '../layanan/layananProduk.js'
import DetailProduk from '../komponen/DetailProduk.jsx'
import BagianProduk from '../komponen/BagianProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import KeadaanKatalog from '../komponen/KeadaanKatalog.jsx'

export default function HalamanDetailProduk() {
  const { slug } = useParams()

  // useSyncExternalStore hanya menerima 3 argumen; slug dilewatkan lewat useCallback.
  const cari = useCallback(() => ambilProdukSlug(slug), [slug])
  useSyncExternalStore(subscribeProduk, cari, cari)
  const status = useSyncExternalStore(subscribeProduk, statusProduk, statusProduk)

  const produk = cari()
  const terkait = useMemo(() => produkTerkait(produk, 4), [produk])

  if (status.memuat || status.galat) return <KeadaanKatalog status={status} />

  if (!produk) {
    return (
      <section className="bagian"><div className="wadah">
        <KeadaanKosong
          judul="Produk tidak ditemukan"
          deskripsi="Produk ini sudah dihapus atau tautannya salah."
          teksTombol="Kembali ke Store"
          tautanTombol="/store"
        />
      </div></section>
    )
  }

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <Link className="tautan-lihat" to="/store">← Kembali ke Store</Link>
      </div></section>
      <section className="bagian"><div className="wadah">
        <DetailProduk key={produk.id} produk={produk} />
      </div></section>
      <BagianProduk judul="Produk Terkait" subjudul="Masih satu kategori dengan produk ini." daftar={terkait} tautan="/store" />
    </>
  )
}

