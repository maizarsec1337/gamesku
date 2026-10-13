// Halaman /store — Marketplace Gamesku + search + filter + sort.
// Katalog dibaca dari layananProduk, kategori dari layananKategori.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import KartuProduk from '../komponen/KartuProduk.jsx'
import FilterProduk from '../komponen/FilterProduk.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import Ikon from '../komponen/Ikon.jsx'
import {
  subscribeProduk,
  produkTersedia,
  cariProduk,
  urutkanProduk,
} from '../layanan/layananProduk.js'
import { subscribeKategori, daftarKategori } from '../layanan/layananKategori.js'
import '../css/filter.css'

export default function Store() {
  const [param, setParam] = useSearchParams()
  const [kataKunci, setKataKunci] = useState(param.get('cari') || '')
  const kategoriProduk = param.get('kategori') || 'semua'
  const urutan = param.get('urut') || 'terbaru'

  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  useSyncExternalStore(subscribeKategori, daftarKategori, daftarKategori)

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

  const kategori = daftarKategori()
  const semuaProduk = produkTersedia()

  const daftarHasil = useMemo(() => {
    let daftar = cariProduk(param.get('cari') || kataKunci)
    if (kategoriProduk !== 'semua') {
      const aktif = kategori.find((k) => k.slug === kategoriProduk || k.id === kategoriProduk)
      if (aktif) daftar = daftar.filter((p) => p.kategoriId === aktif.id)
    }
    return urutkanProduk(daftar, urutan)
    // semuaProduk sengaja tidak dipakai: useSyncExternalStore di atas
    // sudah membuat halaman ikut render ulang saat katalog berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, kataKunci, kategoriProduk, kategori, urutan])

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Marketplace</span>
        <h1 className="judul-halaman">Marketplace Gamesku</h1>
        <p className="subjudul-halaman">Top-up, voucher, skin, item, dan bundle dari kreator kurasi.</p>
        <FilterProduk
          kataKunci={kataKunci}
          pilihKataKunci={setKataKunci}
          kategoriAktif={kategoriProduk}
          pilihKategori={pilihKategori}
          urutAktif={urutan}
          pilihUrut={pilihUrut}
          daftarKategori={kategori}
          jumlah={daftarHasil.length}
        />
      </div></section>
      <section className="bagian"><div className="wadah">
        {daftarHasil.length === 0 ? (
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

