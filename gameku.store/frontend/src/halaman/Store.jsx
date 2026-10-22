// Halaman /store — Marketplace Gamesku + search + filter + sort.
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import KartuProduk from '../komponen/KartuProduk.jsx'
import FilterProduk from '../komponen/FilterProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import KeadaanKatalog from '../komponen/KeadaanKatalog.jsx'
import Ikon from '../komponen/Ikon.jsx'
import {
  subscribeProduk,
  produkTersedia,
  cariProduk,
  urutkanProduk,
  statusProduk,
} from '../layanan/layananProduk.js'
import { subscribeKategori, daftarKategori } from '../layanan/layananKategori.js'
import useReveal from '../layanan/gunakanReveal.js'
import '../css/filter.css'

export default function Store() {
  const [param, setParam] = useSearchParams()
  const kataKunci = param.get('cari') || ''
  const kategoriProduk = param.get('kategori') || 'semua'
  const urutan = param.get('urut') || 'terbaru'

  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  const status = useSyncExternalStore(subscribeProduk, statusProduk, statusProduk)
  useSyncExternalStore(subscribeKategori, daftarKategori, daftarKategori)
  useReveal()

  // Memilih kategori lewat query URL agar bisa dibagikan.
  const pilihKategori = (idKategori) => {
    const baru = new URLSearchParams(param)
    if (idKategori === 'semua') baru.delete('kategori')
    else baru.set('kategori', idKategori)
    setParam(baru)
  }
  const pilihUrut = (idUrut) => {
    const baru = new URLSearchParams(param)
    baru.set('urut', idUrut)
    setParam(baru)
  }
  const pilihKataKunci = (kata) => {
    const baru = new URLSearchParams(param)
    if (kata) baru.set('cari', kata)
    else baru.delete('cari')
    setParam(baru, { replace: true })
  }

  const kategori = daftarKategori()
  const semuaProduk = produkTersedia()
  const kategoriAktif = kategori.find((k) => k.slug === kategoriProduk || k.id === kategoriProduk)

  const daftarHasil = useMemo(() => {
    let daftar = cariProduk(kataKunci, semuaProduk)
    if (kategoriProduk !== 'semua') {
      const aktif = kategori.find((k) => k.slug === kategoriProduk || k.id === kategoriProduk)
      if (aktif) daftar = daftar.filter((p) => p.kategoriId === aktif.id)
    }
    return urutkanProduk(daftar, urutan)
  }, [kataKunci, kategoriProduk, kategori, urutan, semuaProduk])

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Marketplace</span>
        <h1 className="judul-halaman">Marketplace Gamesku</h1>
        <p className="subjudul-halaman">Top-up, voucher, skin, item, dan bundle dari kreator kurasi.</p>
        <FilterProduk
          kataKunci={kataKunci}
          pilihKataKunci={pilihKataKunci}
          kategoriAktif={kategoriAktif?.id || kategoriProduk}
          pilihKategori={pilihKategori}
          urutAktif={urutan}
          pilihUrut={pilihUrut}
          daftarKategori={kategori}
          jumlah={daftarHasil.length}
        />
      </div></section>
      <section className="bagian reveal"><div className="wadah">
        {status.memuat || status.galat ? <KeadaanKatalog status={status} /> : daftarHasil.length === 0 ? (
          <KeadaanKosong
            ikon={<Ikon nama="kotak" ukuran={40} />}
            judul={semuaProduk.length === 0 ? 'Belum ada produk' : 'Produk tidak ditemukan'}
            deskripsi={
              semuaProduk.length === 0
                ? 'Katalog masih kosong. Admin dapat menambahkan produk dari dashboard.'
                : 'Coba kata kunci atau kategori lain.'
            }
            teksTombol="Reset Filter"
            tautanTombol="/store"
          />
        ) : (
          <div className="kisi-produk">
            {daftarHasil.map((produk) => (<KartuProduk key={produk.id} produk={produk} />))}
          </div>
        )}
      </div></section>
    </>
  )
}

