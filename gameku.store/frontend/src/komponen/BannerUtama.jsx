// Hero Gamesku — sapaan + slider promo horizontal otomatis (3 slide).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { subscribeProduk, produkTersedia } from '../layanan/layananProduk.js'
import { formatAngka } from '../utilitas/format.js'

const SLIDE = [
  { id: 's1', kelas: 's1', judul: 'Flash Sale Top-Up s.d. 50%', teks: 'Diamond, Robux, dan voucher favorit. Berakhir malam ini.', cta: 'Serbu Promo', ke: '/promo' },
  { id: 's2', kelas: 's2', judul: 'Top-up instan, main tanpa jeda', teks: 'Bayar sekali, item masuk otomatis ke akunmu.', cta: 'Jelajahi Store', ke: '/store' },
  { id: 's3', kelas: 's3', judul: 'Streamku: nonton & top-up bareng', teks: 'Layanan streaming terpisah dari katalog produk Gamesku.', cta: 'Buka Streamku', ke: '/berita' },
]

export default function BannerUtama() {
  useSyncExternalStore(subscribeProduk, produkTersedia, produkTersedia)
  const [aktif, setAktif] = useState(0)
  const ref = useRef(null)
  const jumlahProduk = produkTersedia().length

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setInterval(() => {
      setAktif((a) => {
        const next = (a + 1) % SLIDE.length
        ref.current?.querySelector(`[data-slide="${SLIDE[next].id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        return next
      })
    }, 4000)
    return () => clearInterval(t)
  }, [])

  const geser = (i) => {
    setAktif(i)
    ref.current?.querySelector(`[data-slide="${SLIDE[i].id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  return (
    <section className="hero" aria-label="Promo Gamesku">
      <div className="wadah hero-isi">
        <span className="lencana lencana-biru">Gamesku Gaming Store</span>
        <h1 className="hero-judul">Top-up cepat.<br /><span>Main tanpa jeda.</span></h1>
        <p className="hero-deskripsi">{formatAngka(jumlahProduk)} produk tersedia · proses instan & aman.</p>
      </div>
      <div className="hero-slider" ref={ref} onScroll={(e) => {
        const el = e.currentTarget
        const i = Math.round(el.scrollLeft / (el.firstChild?.clientWidth || 1))
        if (Number.isFinite(i)) setAktif(Math.min(Math.max(i, 0), SLIDE.length - 1))
      }}>
        {SLIDE.map((s) => (
          <article key={s.id} data-slide={s.id} className={`hero-slide ${s.kelas}`}>
            <h3>{s.judul}</h3>
            <p>{s.teks}</p>
            <Link className="cta" to={s.ke}>{s.cta} →</Link>
          </article>
        ))}
      </div>
      <div className="hero-titik" aria-hidden="true">
        {SLIDE.map((s, i) => (<i key={s.id} className={i === aktif ? 'on' : ''} onClick={() => geser(i)} />))}
      </div>
    </section>
  )
}

