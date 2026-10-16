// Halaman /streamku — katalog anime Streamku (data dari backend /api/anime).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import { katalogAnime, GalatAnime } from '../layanan/layananAnime.js'
import { DaftarAnime, MuatKerangka, GalatStreamku } from '../komponen/StreamkuTayang.jsx'

const PER = 24

export default function HalamanStreamku() {
  useReveal()
  const [params, setParams] = useSearchParams()

  const qAwal = params.get('q') || ''
  const halamanAwal = Math.max(1, parseInt(params.get('halaman') || '1', 10) || 1)

  const [kueri, setKueri] = useState(qAwal)
  const [masukan, setMasukan] = useState(qAwal)
  const [halaman, setHalaman] = useState(halamanAwal)
  const [status, setStatus] = useState('memuat') // memuat | siap | galat
  const [galat, setGalat] = useState('')
  const [data, setData] = useState(null)
  const [muatUlang, setMuatUlang] = useState(0)

  // Ambil katalog setiap kali q / halaman / pemicu muat-ulang berubah.
  useEffect(() => {
    let batal = false
    setStatus('memuat')
    setGalat('')
    katalogAnime({ q: kueri, halaman, per: PER })
      .then((d) => {
        if (batal) return
        setData(d)
        setStatus('siap')
      })
      .catch((e) => {
        if (batal) return
        setGalat(e instanceof GalatAnime ? e.message : 'Tidak dapat memuat katalog anime.')
        setStatus('galat')
      })
    return () => { batal = true }
  }, [kueri, halaman, muatUlang])

  // Sinkronkan URL (?q & ?halaman) agar detail/refresh bekerja.
  const pertama = useRef(true)
  useEffect(() => {
    if (pertama.current) { pertama.current = false; return }
    const p = new URLSearchParams()
    if (kueri) p.set('q', kueri)
    if (halaman > 1) p.set('halaman', String(halaman))
    setParams(p, { replace: true })
  }, [kueri, halaman, setParams])

  // Pencarian: tekan Enter / submit untuk query ke server.
  const kirimCari = (e) => {
    e.preventDefault()
    const nilai = masukan.trim()
    setHalaman(1)
    setKueri(nilai)
  }

  const cobaLagi = useCallback(() => setMuatUlang((n) => n + 1), [])

  const keHalaman = (n) => {
    setHalaman(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalHalaman = data?.totalHalaman || 1
  const total = data?.total || 0

  return (
    <>
      <section className="kepala-bagian"><div className="wadah sk-kepala-atas">
        <div>
          <span className="lencana lencana-merah"><Ikon nama="siaran" ukuran={13} /> Streamku</span>
          <h1 className="judul-halaman">Streamku</h1>
          <p className="subjudul-halaman">Katalog anime Gameku.store — telusuri seri dan episode dari katalog resmi.</p>
        </div>
        <form className="sk-cari-atas" role="search" onSubmit={kirimCari}>
          <Ikon nama="cari" ukuran={16} />
          <input
            value={masukan}
            onChange={(e) => setMasukan(e.target.value)}
            placeholder="Cari judul anime…"
            aria-label="Cari anime"
          />
        </form>
      </div></section>

      <section className="bagian reveal"><div className="wadah">
        <div className="judul-bagian">
          <div>
            <h2>{kueri ? `Hasil untuk “${kueri}”` : 'Katalog Anime'}</h2>
            <p>
              {status === 'siap'
                ? `${total} seri ditemukan.`
                : status === 'memuat' ? 'Memuat katalog…' : 'Gagal memuat katalog.'}
            </p>
          </div>
        </div>

        {status === 'memuat' && <MuatKerangka jumlah={PER} />}
        {status === 'galat' && <GalatStreamku pesan={galat} onCobaLagi={cobaLagi} />}
        {status === 'siap' && (
          <>
            <DaftarAnime daftar={data.items} />
            {totalHalaman > 1 && (
              <nav className="sk-navigasi-halaman" aria-label="Navigasi halaman">
                <button type="button" className="pil" onClick={() => keHalaman(halaman - 1)} disabled={halaman <= 1}>
                  <Ikon nama="panahKiri" ukuran={14} /> Sebelumnya
                </button>
                <span className="sk-info-halaman">Halaman {halaman} dari {totalHalaman}</span>
                <button type="button" className="pil" onClick={() => keHalaman(halaman + 1)} disabled={halaman >= totalHalaman}>
                  Berikutnya <Ikon nama="panahKanan" ukuran={14} />
                </button>
              </nav>
            )}
          </>
        )}
      </div></section>
    </>
  )
}
