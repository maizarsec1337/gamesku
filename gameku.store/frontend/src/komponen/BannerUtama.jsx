// Banner utama Beranda — hero carousel editorial.
// Empat slide tetap (Top Up Gaming, Promo Gamesku, Produk Digital, Streamku Anime)
// dengan naskah promosi contoh. Setiap CTA menuju rute yang benar-benar ada.
// Komponen ini tidak membaca katalog produk maupun backend.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import { formatRupiah } from '../utilitas/format.js'

const DURASI = 5000

const SLIDE = [
  {
    id: 'topup',
    tema: 'topup',
    label: 'Top Up Gaming',
    judul: 'Top up game favoritmu, diproses otomatis.',
    deskripsi: 'Pilih nominal, bayar, lalu saldo masuk ke akunmu. Pembayaran terenkripsi dan status pesanan bisa dilacak.',
    cta: { teks: 'Top Up Sekarang', ke: '/store' },
  },
  {
    id: 'promo',
    tema: 'promo',
    label: 'Promo Gamesku',
    judul: 'Potongan harga mingguan untuk top-up dan voucher.',
    deskripsi: 'Setiap diskon dihitung dari harga katalog, jadi angka coret yang kamu lihat memang harga aslinya.',
    cta: { teks: 'Lihat Promo', ke: '/promo' },
  },
  {
    id: 'digital',
    tema: 'digital',
    label: 'Produk Digital',
    judul: 'Skin, map, dan add-on dari kreator lokal.',
    deskripsi: 'Produk dipilih manual oleh tim, masing-masing punya halaman detail sendiri beserta riwayat pembaruannya.',
    cta: { teks: 'Jelajahi Kategori', ke: '/kategori' },
  },
  {
    id: 'streamku',
    tema: 'streamku',
    label: 'Streamku Anime',
    judul: 'Katalog anime lengkap dengan daftar episodenya.',
    deskripsi: 'Telusuri ratusan seri, buka halaman detailnya, lalu lompat langsung ke episode yang kamu cari.',
    cta: { teks: 'Buka Streamku', ke: '/streamku' },
  },
]

const NOMINAL = ['86 Diamond', '172 Diamond', '344 Diamond']

// Visual tiap slide dibangun dari kosakata toko sendiri — pemilih nominal,
// tiket diskon, kartu produk, dan poster seri. Murni dekoratif.
function VisualSlide({ tema }) {
  if (tema === 'topup') {
    return (
      <div className="gk-vis gk-vis-nominal">
        <span className="gk-vis-tanda">Pilih nominal</span>
        <ul>
          {NOMINAL.map((teks, i) => (
            <li key={teks} className={i === 1 ? 'on' : ''}>
              <span className="gk-vis-koin" />
              <span className="gk-vis-teks">{teks}</span>
              <span className="gk-vis-pilih" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (tema === 'promo') {
    return (
      <div className="gk-vis gk-vis-tiket">
        <span className="gk-vis-tanda">Promo mingguan</span>
        <strong className="gk-vis-besar">−35%</strong>
        <span className="gk-vis-harga">
          <s>{formatRupiah(45000)}</s>
          {formatRupiah(29000)}
        </span>
        <span className="gk-vis-catatan">Contoh tampilan diskon</span>
      </div>
    )
  }

  if (tema === 'digital') {
    return (
      <div className="gk-vis gk-vis-produk">
        {[['Skin', 29000], ['Map', 45000]].map(([jenis, harga], i) => (
          <div key={jenis} className={i === 1 ? 'gk-vis-kartu naik' : 'gk-vis-kartu'}>
            <span className="gk-vis-muka" />
            <span className="gk-vis-garis" />
            <span className="gk-vis-harga-kartu">{formatRupiah(harga)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="gk-vis gk-vis-poster">
      <span className="gk-vis-bingkai">
        <span className="gk-vis-putar" />
        <span className="gk-vis-episode">Eps 12</span>
      </span>
      <span className="gk-vis-garis" />
      <span className="gk-vis-garis pendek" />
    </div>
  )
}

export default function BannerUtama() {
  const jumlah = SLIDE.length
  const [aktif, setAktif] = useState(0)
  const [jedaArah, setJedaArah] = useState(false)
  const [diam, setDiam] = useState(false)
  const [kurangiGerak, setKurangiGerak] = useState(false)
  const sentuhX = useRef(null)

  const pilih = useCallback((i) => setAktif(i), [])
  const berikut = useCallback(() => setAktif((a) => (a + 1) % jumlah), [jumlah])
  const sebelum = useCallback(() => setAktif((a) => (a - 1 + jumlah) % jumlah), [jumlah])

  // Hormati preferensi sistem: tanpa putar otomatis, transisi dinetralkan CSS.
  useEffect(() => {
    const kueri = window.matchMedia('(prefers-reduced-motion: reduce)')
    const terapkan = () => setKurangiGerak(kueri.matches)
    terapkan()
    kueri.addEventListener('change', terapkan)
    return () => kueri.removeEventListener('change', terapkan)
  }, [])

  // Jangan memutar slide saat tab tidak aktif.
  useEffect(() => {
    const tangani = () => setDiam(document.hidden)
    tangani()
    document.addEventListener('visibilitychange', tangani)
    return () => document.removeEventListener('visibilitychange', tangani)
  }, [])

  useEffect(() => {
    if (jedaArah || diam || kurangiGerak || jumlah < 2) return undefined
    const t = setInterval(() => setAktif((a) => (a + 1) % jumlah), DURASI)
    return () => clearInterval(t)
  }, [jedaArah, diam, kurangiGerak, jumlah, aktif])

  const tombolKunci = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); berikut() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); sebelum() }
  }

  const sentuhMulai = (e) => { sentuhX.current = e.touches[0].clientX }
  const sentuhSelesai = (e) => {
    if (sentuhX.current === null) return
    const dx = e.changedTouches[0].clientX - sentuhX.current
    if (dx > 40) sebelum()
    else if (dx < -40) berikut()
    sentuhX.current = null
  }

  return (
    <section className="wadah gk-hero" aria-label="Sorotan Gamesku">
      <h1 className="sr-hanya">Gamesku — top up game, voucher, dan produk digital</h1>
      <div
        className="gk-hero-bingkai"
        role="region"
        aria-roledescription="carousel"
        aria-label="Sorotan Gamesku"
        tabIndex={-1}
        onKeyDown={tombolKunci}
        onMouseEnter={() => setJedaArah(true)}
        onMouseLeave={() => setJedaArah(false)}
        onFocus={() => setJedaArah(true)}
        onBlur={() => setJedaArah(false)}
        onTouchStart={sentuhMulai}
        onTouchEnd={sentuhSelesai}
      >
        <div className="gk-hero-lintasan">
          {SLIDE.map((s, i) => {
            const hidup = i === aktif
            return (
              <article
                key={s.id}
                className={`gk-hero-slide tema-${s.tema}${hidup ? ' aktif' : ''}`}
                aria-hidden={!hidup}
                aria-roledescription="slide"
                aria-label={`${i + 1} dari ${jumlah}: ${s.label}`}
              >
                <div className="gk-hero-isi">
                  <span className="gk-hero-label">{s.label}</span>
                  <h2 className="gk-hero-judul">{s.judul}</h2>
                  <p className="gk-hero-desk">{s.deskripsi}</p>
                  <Link className="gk-hero-cta" to={s.cta.ke} tabIndex={hidup ? 0 : -1}>
                    {s.cta.teks}
                    <Ikon nama="panahKanan" ukuran={15} />
                  </Link>
                </div>
                <div className="gk-hero-visual" aria-hidden="true">
                  <VisualSlide tema={s.tema} />
                </div>
              </article>
            )
          })}
        </div>

        <div className="gk-hero-kendali">
          <div className="gk-hero-titik">
            {SLIDE.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={i === aktif ? 'on' : ''}
                aria-label={`Buka sorotan ${i + 1}: ${s.label}`}
                aria-current={i === aktif}
                onClick={() => pilih(i)}
              />
            ))}
          </div>
          <div className="gk-hero-panah">
            <span className="gk-hero-nomor" aria-hidden="true">{aktif + 1}/{jumlah}</span>
            <button type="button" onClick={sebelum} aria-label="Sorotan sebelumnya">
              <Ikon nama="panahKiri" ukuran={16} />
            </button>
            <button type="button" onClick={berikut} aria-label="Sorotan berikutnya">
              <Ikon nama="panahKanan" ukuran={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
