// Halaman /kategori dan /kategori/:slug — data dari service Gameku.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import KartuProduk from '../komponen/KartuProduk.jsx'
import FilterProduk from '../komponen/FilterProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import {
  subscribeProduk,
  produkTersedia,
  cariProduk,
  urutkanProduk,
} from '../layanan/layananProduk.js'
import { subscribeKategori, daftarKategori } from '../layanan/layananKategori.js'
import useReveal from '../layanan/gunakanReveal.js'
import '../css/filter.css'

export default function HalamanKategori() {
  const { slug } = useParams()
  const [kataKunci, setKataKunci] = useState('')
  const [urutan, setUrutan] = useState('terbaru')

  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  useSyncExternalStore(subscribeKategori, daftarKategori, daftarKategori)
  useReveal()

  const kategori = daftarKategori()
  const aktif = kategori.find((k) => k.slug === slug)
  const kategoriAktif = aktif?.id || 'semua'

  const semuaProduk = produkTersedia()

  const daftarHasil = useMemo(() => {
    let daftar = cariProduk(kataKunci)
    if (kategoriAktif !== 'semua') daftar = daftar.filter((p) => p.kategoriId === kategoriAktif)
    return urutkanProduk(daftar, urutan)
    // eslint-disable-next-line react-hooks/exhaustive-deps (katalog sudah di-subscribe)
  }, [kataKunci, kategoriAktif, urutan])

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Kategori</span>
        <h1 className="judul-halaman">{aktif ? aktif.nama : 'Semua Kategori'}</h1>
        <p className="subjudul-halaman">Pilih kategori atau buka langsung dari daftar.</p>
        <div className="pil-kategori" style={{ marginTop: 12 }}>
          <Link className={kategoriAktif === 'semua' ? 'pil pil-aktif' : 'pil'} to="/kategori">Semua</Link>
          {kategori.map((k) => (
            <Link key={k.id} className={kategoriAktif === k.id ? 'pil pil-aktif' : 'pil'} to={`/kategori/${k.slug}`}>{k.nama}</Link>
          ))}
        </div>
        <FilterProduk
          kataKunci={kataKunci}
          pilihKataKunci={setKataKunci}
          kategoriAktif={kategoriAktif}
          pilihKategori={() => {}}
          urutAktif={urutan}
          pilihUrut={setUrutan}
          daftarKategori={[]}
          jumlah={daftarHasil.length}
        />
      </div></section>
      <section className="bagian reveal"><div className="wadah">
        {daftarHasil.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada produk"
            deskripsi={semuaProduk.length === 0 ? 'Katalog masih kosong.' : 'Kategori ini masih kosong.'}
            teksTombol="Lihat Store"
            tautanTombol="/store"
          />
        ) : (
          <div className="kisi-produk">
            {daftarHasil.map((p) => (<KartuProduk key={p.id} produk={p} />))}
          </div>
        )}
      </div></section>
    </>
  )
}
