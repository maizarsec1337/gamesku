// Halaman /streamku/:slug — detail seri + daftar episode (dari backend /api/anime).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import { detailAnime, GalatAnime } from '../layanan/layananAnime.js'
import { BarisEpisode, StatusPemutaran, GalatStreamku, MuatKerangka } from '../komponen/StreamkuTayang.jsx'

export default function HalamanDetailAnime() {
  const { slug } = useParams()
  useReveal()
  const [status, setStatus] = useState('memuat') // memuat | siap | galat
  const [galat, setGalat] = useState('')
  const [kodeGalat, setKodeGalat] = useState(0)
  const [data, setData] = useState(null)
  const [muatUlang, setMuatUlang] = useState(0)

  useEffect(() => {
    let batal = false
    setStatus('memuat')
    setGalat('')
    detailAnime(slug)
      .then((d) => { if (!batal) { setData(d); setStatus('siap') } })
      .catch((e) => {
        if (batal) return
        setGalat(e instanceof GalatAnime ? e.message : 'Tidak dapat memuat detail anime.')
        setKodeGalat(e instanceof GalatAnime ? e.status : 0)
        setStatus('galat')
      })
    return () => { batal = true }
  }, [slug, muatUlang])

  const cobaLagi = useCallback(() => setMuatUlang((n) => n + 1), [])

  const seri = data?.seri
  const daftarEps = Array.isArray(data?.episode) ? data.episode : []
  const poster = String(seri?.gambar || '').trim()

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <Link className="tautan-lihat" to="/streamku"><Ikon nama="panahKiri" ukuran={14} /> Kembali ke Streamku</Link>
        {status === 'siap' && seri ? (
          <>
            <span className="lencana lencana-merah" style={{ marginTop: 10, display: 'inline-flex' }}>
              <Ikon nama="siaran" ukuran={13} /> Streamku
            </span>
            <h1 className="judul-halaman">{seri.judul}</h1>
            <p className="subjudul-halaman">{seri.jumlahEpisode || daftarEps.length} episode tersedia.</p>
          </>
        ) : (
          <>
            <span className="lencana lencana-merah" style={{ marginTop: 10, display: 'inline-flex' }}>
              <Ikon nama="siaran" ukuran={13} /> Streamku
            </span>
            <h1 className="judul-halaman">{status === 'memuat' ? 'Memuat…' : 'Detail Anime'}</h1>
          </>
        )}
      </div></section>

      <section className="bagian reveal"><div className="wadah">
        {status === 'memuat' && <MuatKerangka jumlah={6} />}

        {status === 'galat' && kodeGalat === 404 && (
          <KeadaanKosong
            ikon="siaran"
            judul="Anime tidak ditemukan"
            deskripsi="Seri yang kamu cari tidak ada di katalog Streamku."
            teksTombol="Ke Katalog Streamku"
            tautanTombol="/streamku"
          />
        )}
        {status === 'galat' && kodeGalat !== 404 && (
          <GalatStreamku pesan={galat} onCobaLagi={cobaLagi} />
        )}

        {status === 'siap' && seri && (
          <div className="sk-detail">
            <div className="sk-detail-poster sk-thumb sk-thumb-video">
              {poster ? (
                <img src={poster} alt="" loading="lazy" decoding="async"
                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <span className="sk-thumb-ikon"><Ikon nama="siaran" ukuran={40} /></span>
              )}
            </div>
            <div className="sk-detail-isi">
              <StatusPemutaran />
              <div className="judul-bagian" style={{ marginTop: 18 }}>
                <div><h2>Daftar Episode</h2><p>{daftarEps.length} episode.</p></div>
              </div>
              {daftarEps.length === 0 ? (
                <KeadaanKosong ikon="siaran" judul="Belum ada episode" deskripsi="Daftar episode untuk seri ini belum tersedia." />
              ) : (
                <ul className="sk-eps-daftar">
                  {daftarEps.map((e) => (<BarisEpisode key={e.no} episode={e} />))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div></section>
    </>
  )
}
