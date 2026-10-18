// Halaman /streamku/:slug — detail seri + daftar episode (dari backend /api/anime).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import { detailAnime, episodeAnime, GalatAnime } from '../layanan/layananAnime.js'
import { BarisEpisode, PemutarVideo, GalatStreamku, MuatKerangka } from '../komponen/StreamkuTayang.jsx'

export default function HalamanDetailAnime() {
  const { slug } = useParams()
  useReveal()
  const [status, setStatus] = useState('memuat') // memuat | siap | galat
  const [galat, setGalat] = useState('')
  const [kodeGalat, setKodeGalat] = useState(0)
  const [data, setData] = useState(null)
  const [muatUlang, setMuatUlang] = useState(0)
  const [pilihanEps, setPilihanEps] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoEmbed, setVideoEmbed] = useState(null)
  const [videoMemuat, setVideoMemuat] = useState(false)
  const [videoGalat, setVideoGalat] = useState('')

  const pilihEpisode = async (no) => {
    const eps = Array.isArray(data?.episode) ? data.episode.find((e) => Number(e.no) === no) : null
    if (!eps) return
    setPilihanEps(eps)
    setVideoMemuat(true)
    setVideoGalat('')
    setVideoUrl(null)
    setVideoEmbed(null)
    try {
      const epData = await episodeAnime(slug, no)
      const ep = epData && epData.episode
      // Kontrak backend: sumberPemutaran ('mp4'|'hls'|'belum-tersedia'),
      // urlPemutaran (URL video langsung), embedPemutaran (iframe resmi).
      // `link` episode adalah URL HALAMAN — bukan URL video; jangan dipakai
      // sebagai sumber pemutaran.
      const langsung = ep && ep.urlPemutaran && /^https?:\/\//.test(String(ep.urlPemutaran))
        ? String(ep.urlPemutaran) : null
      const embed = ep && ep.embedPemutaran && /^https?:\/\//.test(String(ep.embedPemutaran))
        ? String(ep.embedPemutaran) : null
      if (ep && String(ep.sumberPemutaran || '') === 'mp4' && langsung) {
        setVideoUrl(langsung)
      } else if (embed) {
        // HLS butuh pemutar khusus; embed resmi menanganinya di sisi mereka.
        setVideoEmbed(embed)
      } else {
        setVideoGalat('Sumber pemutaran untuk episode ini belum tersedia di sumber resmi. Buka tautan halaman episode resmi untuk menonton.')
      }
    } catch (e) {
      setVideoGalat(e instanceof GalatAnime ? e.message : 'Gagal memuat sumber episode.')
    } finally {
      setVideoMemuat(false)
    }
  }

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
  const episodeAktif = pilihanEps ? Number(pilihanEps.no) : null

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
              <PemutarVideo
                videoUrl={videoUrl}
                embedUrl={videoEmbed}
                judulEpisode={pilihanEps ? pilihanEps.judul : null}
                onError={(kode, pesan) => setVideoGalat(pesan)}
              />
              {videoMemuat && !videoUrl && !videoEmbed && !videoGalat && (
                <div className="sk-pemutar sk-pemutar-muat" role="status" aria-label="Memuat sumber episode…">
                  <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="muat" ukuran={32} /></span>
                  <strong>Mencari sumber episode…</strong>
                </div>
              )}
              {videoGalat && !videoUrl && !videoEmbed && (
                <div className="sk-pemutar sk-pemutar-galat" role="alert">
                  <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="peringatan" ukuran={32} /></span>
                  <strong>Sumber video tidak tersedia</strong>
                  <p>{videoGalat}</p>
                </div>
              )}
              <div className="judul-bagian" style={{ marginTop: 18 }}>
                <div><h2>Daftar Episode</h2><p>{daftarEps.length} episode.</p></div>
              </div>
              {daftarEps.length === 0 ? (
                <KeadaanKosong ikon="siaran" judul="Belum ada episode" deskripsi="Daftar episode untuk seri ini belum tersedia." />
              ) : (
                <ul className="sk-eps-daftar">
                  {daftarEps.map((e) => (
                    <BarisEpisode
                      key={e.no}
                      episode={e}
                      aktif={episodeAktif}
                      onPilih={pilihEpisode}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div></section>
    </>
  )
}
