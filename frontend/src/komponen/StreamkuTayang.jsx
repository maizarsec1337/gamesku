// Komponen presentasi Streamku (katalog anime). Semua field dirender hanya bila
// benar-benar ada di data backend — tidak ada poster/judul/episode karangan.
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import KeadaanKosong from './KeadaanKosong.jsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

// Kerangka muat (skeleton) saat data sedang diambil.
export function MuatKerangka({ jumlah = 8 }) {
  return (
    <div className="sk-grid" aria-hidden="true">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="sk-kartu sk-kerangka">
          <div className="sk-thumb sk-thumb-portrait" />
          <div className="sk-badan">
            <span className="sk-garis-teks" />
            <span className="sk-garis-teks sk-garis-pendek" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Kartu anime: poster portrait asli (2:3) + badge + judul; menuju halaman detail.
export function KartuAnime({ seri }) {
  const poster = String(seri?.gambar || '').trim()
  const judul = String(seri?.judul || '').trim()
  const jumlahEps = Number(seri?.jumlahEpisode || 0)
  const slug = String(seri?.slug || '').trim()

  return (
    <Link
      className="sk-kartu"
      to={`/streamku/${encodeURIComponent(slug)}`}
      aria-label={judul || 'Detail anime'}
    >
      <div className="sk-thumb sk-thumb-portrait">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span className="sk-thumb-ikon"><Ikon nama="siaran" ukuran={30} /></span>
        )}
        {jumlahEps > 0 && (
          <span className="sk-badge">
            <Ikon nama="siaran" ukuran={10} /> {jumlahEps} eps
          </span>
        )}
      </div>
      <div className="sk-badan">
        {judul && <h3 className="sk-judul">{judul}</h3>}
      </div>
    </Link>
  )
}

// Grid katalog; kosong = empty state jujur (bukan data contoh).
export function DaftarAnime({ daftar }) {
  if (!Array.isArray(daftar) || daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon="siaran"
        judul="Belum ada anime yang cocok"
        deskripsi="Tidak ada seri yang ditemukan untuk pencarian ini. Coba kata kunci lain."
      />
    )
  }
  return (
    <div className="sk-grid">
      {daftar.map((s) => (<KartuAnime key={s.slug} seri={s} />))}
    </div>
  )
}

// Satu baris episode. Data hanya berisi tautan halaman episode (bukan URL video).
export function BarisEpisode({ episode, aktif, onPilih }) {
  const no = Number(episode?.no || 0)
  const judul = String(episode?.judul || '').trim()
  const tautan = String(episode?.link || '').trim()
  const tanggal = formatTanggal(episode?.tanggal)
  const aman = /^https?:\/\//.test(tautan)
  const dipilih = aktif === no
  return (
    <li className={"sk-eps" + (dipilih ? " sk-eps-aktif" : "")}>
      <span className="sk-eps-no">{no ? 'Eps ' + no : '—'}</span>
      <span className="sk-eps-judul">
        {judul || 'Episode ' + no}
        {tanggal && <span className="sk-eps-tanggal">{tanggal}</span>}
      </span>
      <button
        type="button"
        className="sk-eps-pilih"
        onClick={() => onPilih && onPilih(no)}
        aria-label={dipilih ? 'Episode ' + no + ' sudah dipilih' : 'Putar Episode ' + no}
        disabled={dipilih}
      >
        {dipilih ? 'Dipilih' : 'Putar'}
      </button>
      {aman ? (
        <a className="sk-eps-tautan" href={tautan} target="_blank" rel="noreferrer noopener">
          Halaman <Ikon nama="panahKanan" ukuran={14} />
        </a>
      ) : (
        <span className="sk-eps-tautan sk-eps-nonaktif">Tautan tidak tersedia</span>
      )}
    </li>
  )
}

// Tanggal episode dalam format id-ID; kosong bila data tidak ada/tak valid.
function formatTanggal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Pemutar video internal: tampil bila ada URL video langsung atau iframe embed resmi.
// Tangani loading, error, format tidak didukung, dan CORS secara jelas.
export function PemutarVideo({ videoUrl, embedUrl, judulEpisode, onError }) {
  const [memuat, setMemuat] = useState(Boolean(videoUrl))
  const [gagalMemutar, setGagalMemutar] = useState(false)
  const [pesanGalat, setPesanGalat] = useState('')
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  const URL_VIDEO_VALID = videoUrl && /^https?:\/\//.test(String(videoUrl))
  const EMBED_VALID = !URL_VIDEO_VALID && embedUrl && /^https?:\/\//.test(String(embedUrl))

  const tanganiGalat = useCallback((kode, pesan) => {
    setGagalMemutar(true)
    setMemuat(false)
    setPesanGalat(pesan)
    if (typeof onError === 'function') onError(kode, pesan)
  }, [onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !URL_VIDEO_VALID || !/\.m3u8(?:\?|$)/i.test(String(videoUrl))) return undefined
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = String(videoUrl)
      return undefined
    }
    if (!Hls.isSupported()) {
      tanganiGalat('hls', 'Browser ini tidak mendukung pemutaran HLS.')
      return undefined
    }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
    hlsRef.current = hls
    hls.loadSource(String(videoUrl))
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => setMemuat(false))
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data?.fatal) tanganiGalat('hls', 'Sumber HLS gagal dimuat atau sudah tidak tersedia.')
    })
    return () => { hls.destroy(); hlsRef.current = null }
  }, [URL_VIDEO_VALID, videoUrl, tanganiGalat])

  const tanganiKesalahanMedia = () => {
    tanganiGalat('media', 'Format video tidak dapat diputar oleh browser ini.')
  }

  if (!URL_VIDEO_VALID && !EMBED_VALID) {
    return (
      <div className="sk-pemutar sk-pemutar-kosong" role="status" aria-label="Sumber pemutaran belum tersedia">
        <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="siaran" ukuran={40} /></span>
        <strong>Sumber pemutaran belum tersedia</strong>
        <p>
          Pemutar mencari sumber resmi otomatis saat kamu memilih episode.
          Bila kosong, sumber upstream memang belum menyediakan video untuk episode ini —
          buka tautan halaman episode resmi untuk menonton.
        </p>
      </div>
    )
  }

  if (EMBED_VALID) {
    return (
      <div className="sk-pemutar sk-pemutar-aktif">
        <iframe
          className="sk-video sk-video-embed"
          src={String(embedUrl)}
          title={judulEpisode || 'Pemutar episode'}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />
        <p className="sk-pemutar-judul">{judulEpisode || 'Episode'}</p>
      </div>
    )
  }


  return (
    <div className="sk-pemutar sk-pemutar-aktif">
      {memuat && !gagalMemutar ? (
        <div className="sk-pemutar-muat">
          <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="muat" ukuran={32} /></span>
          <strong>Memuat pemutar…</strong>
        </div>
      ) : (
        <>
          {gagalMemutar ? (
            <div className="sk-pemutar sk-pemutar-galat" role="alert">
              <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="peringatan" ukuran={32} /></span>
              <strong>Tidak dapat memutar video</strong>
              <p>{pesanGalat || 'Terjadi kesalahan saat memuat sumber pemutaran.'}</p>
              <p className="sk-pemutar-catatan">
                Sumber video ini mungkin tidak tersedia, dibatasi CORS, atau format tidak didukung.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="sk-video"
                src={videoUrl}
                controls
                preload="metadata"
                poster=""
                onLoadStart={() => setMemuat(true)}
                onCanPlay={() => setMemuat(false)}
                onError={tanganiKesalahanMedia}
                aria-label={judulEpisode || 'Video episode'}
              >
                Track pada browser Anda tidak dapat memutar video ini.
              </video>
              <p className="sk-pemutar-judul">{judulEpisode || 'Episode'}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

// Catatan jujur: sumber pemutaran video belum ada & terverifikasi.
export function StatusPemutaran() {
  return (
    <div className="sk-pemutar sk-pemutar-kosong" role="status" aria-label="Sumber pemutaran belum tersedia">
      <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="siaran" ukuran={40} /></span>
      <strong>Sumber pemutaran belum tersedia</strong>
      <p>
        Katalog ini menyediakan metadata &amp; tautan halaman episode resmi.
        Pemutar video internal akan aktif setelah ada sumber streaming yang sah dan teruji —
        tanpa URL video karangan.
      </p>
    </div>
  )
}

// Keadaan galat API dengan tombol coba lagi yang berfungsi.
export function GalatStreamku({ pesan, onCobaLagi }) {
  return (
    <div className="sk-galat" role="alert">
      <div className="sk-galat-ikon" aria-hidden="true"><Ikon nama="info" ukuran={22} /></div>
      <div className="sk-galat-isi">
        <strong>Gagal memuat data Streamku</strong>
        <p>{pesan || 'Terjadi kesalahan tak terduga.'}</p>
        {onCobaLagi && (
          <button type="button" className="tombol tombol-utama tombol-kecil" onClick={onCobaLagi}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  )
}








