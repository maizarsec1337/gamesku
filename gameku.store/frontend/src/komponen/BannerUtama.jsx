// Banner Home — carousel otomatis dari DATA ASLI.
// Sumber: produkTersedia() + namaKategori(). Diskon asli dulu, maks 6.
// Katalog kosong = empty state jujur, BUKAN promo karangan.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import { subscribeProduk, produkTersedia } from '../layanan/layananProduk.js'
import { namaKategori } from '../layanan/layananKategori.js'
import { formatAngka, formatRupiah } from '../utilitas/format.js'

const DURASI = 5000
const TEMA = ['sale', 'skin', 'map', 'stream']

export default function BannerUtama() {
  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  const [aktif, setAktif] = useState(0)
  const [jeda, setJeda] = useState(false)
  const sentuhX = useRef(null)
  const semua = produkTersedia()
  const diskon = semua.filter((p) => p.hargaDiskon > 0 && p.hargaDiskon > p.harga)
  const biasa = semua.filter((p) => !(p.hargaDiskon > 0 && p.hargaDiskon > p.harga))
  const slide = [...diskon, ...biasa].slice(0, 6)
  const jumlah = slide.length
  const berikut = useCallback(() => {
    if (jumlah > 1) setAktif((a) => (a + 1) % jumlah)
  }, [jumlah])
  const sebelum = useCallback(() => {
    if (jumlah > 1) setAktif((a) => (a - 1 + jumlah) % jumlah)
  }, [jumlah])

  useEffect(() => { setAktif(0) }, [jumlah])
  useEffect(() => {
    if (jeda || jumlah < 2) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setInterval(() => {
      setAktif((a) => (a + 1) % jumlah)
    }, DURASI)
    return () => clearInterval(t)
  }, [jeda, jumlah, aktif])


  const sentuhMulai = (e) => { sentuhX.current = e.touches[0].clientX }
  const sentuhSelesai = (e) => {
    if (sentuhX.current === null) return
    const dx = e.changedTouches[0].clientX - sentuhX.current
    if (dx > 40) sebelum()
    else if (dx < -40) berikut()
    sentuhX.current = null
  }

  return (
    <section className="wadah gk-banner-wrap">
      <div className="gk-banner-head">
        <span className="lencana lencana-biru">Gameku.store · Gaming Store</span>
        <p className="gk-banner-count">{formatAngka(semua.length)} produk tersedia · dari katalog asli.</p>
      </div>
      {jumlah === 0 ? (
        <div className="gk-banner-kosong">
          <Ikon nama="toko" ukuran={30} />
          <div>
            <strong>Belum ada banner</strong>
            <p>Katalog masih kosong — banner tampil otomatis setelah admin menerbitkan produk. Tidak ada promo yang dikarang.</p>
          </div>
          <Link className="tombol tombol-garis tombol-kecil" to="/store">Lihat Store</Link>
        </div>
      ) : (
        <div className="gk-banner" role="region" aria-roledescription="carousel" aria-label="Banner produk Gameku.store" onMouseEnter={() => setJeda(true)} onMouseLeave={() => setJeda(false)} onFocus={() => setJeda(true)} onBlur={() => setJeda(false)} onTouchStart={sentuhMulai} onTouchEnd={sentuhSelesai}>
          <div className="gk-banner-track">
            {slide.map((p, i) => {
              const persen = p.hargaDiskon > p.harga ? Math.round((1 - p.harga / p.hargaDiskon) * 100) : 0
              const kat = namaKategori(p.kategoriId)
              const tema = TEMA[i % TEMA.length]
              return (
                <article key={p.id} className={`gk-slide tema-${tema}${i === aktif ? ' aktif' : ''}`} aria-hidden={i !== aktif} aria-roledescription="slide" aria-label={`${i + 1} dari ${jumlah}: ${p.nama}`}>
                  <div className="gk-slide-isi">
                    <span className="gk-slide-label">{kat || p.jenis || 'Produk'}{persen > 0 ? ` · -${persen}%` : ''}</span>
                    <h2>{p.nama}</h2>
                    <p>{p.harga === 0 ? 'Gratis' : formatRupiah(p.harga)}{p.hargaDiskon > p.harga ? ` (coret ${formatRupiah(p.hargaDiskon)})` : ''}{p.creator ? ` · oleh ${p.creator}` : ''}</p>
                    <Link className="gk-slide-cta" to={`/produk/${p.slug}`} tabIndex={i === aktif ? 0 : -1}>Lihat Produk <Ikon nama="panahKanan" ukuran={15} /></Link>
                  </div>
                  <div className="gk-slide-visual" aria-hidden="true"><span className="gk-slide-ikon"><Ikon nama="toko" ukuran={54} /></span></div>
                </article>
              )
            })}
          </div>
          {jumlah > 1 && (
            <>
              <button type="button" className="gk-banner-nav sebelum" onClick={sebelum} aria-label="Banner sebelumnya"><Ikon nama="panahKiri" ukuran={18} /></button>
              <button type="button" className="gk-banner-nav berikut" onClick={berikut} aria-label="Banner berikutnya"><Ikon nama="panahKanan" ukuran={18} /></button>
              <div className="gk-banner-titik" role="tablist" aria-label="Pilih banner">
                {slide.map((p, i) => (
                  <button key={p.id} type="button" role="tab" aria-selected={i === aktif} aria-label={`Banner ${i + 1}: ${p.nama}`} className={i === aktif ? 'on' : ''} onClick={() => setAktif(i)} />
                ))}
              </div>
              <span className="gk-banner-nomor" aria-hidden="true">{aktif + 1} / {jumlah}</span>
            </>
          )}
        </div>
      )}
    </section>
  )
}
