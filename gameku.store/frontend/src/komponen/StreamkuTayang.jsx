// Komponen presentasi Streamku; hanya merender field yang benar-benar ada.
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import KeadaanKosong from './KeadaanKosong.jsx'

// Area pemutar utama 16:9; <video>/<iframe> hanya bila URL nyata tersedia.
export function AreaVideoUtama({ video }) {
  const sumber = String(video?.urlVideo || video?.url || '').trim()
  if (!video || !sumber) {
    return (
      <div className="sk-pemutar sk-pemutar-kosong" role="status" aria-label="Belum ada video">
        <span className="sk-pemutar-ikon" aria-hidden="true"><Ikon nama="siaran" ukuran={44} /></span>
        <strong>Belum ada video yang diputar</strong>
        <p>API video resmi belum dihubungkan. Area ini otomatis menampilkan pemutar 16:9 setelah data tersedia — tidak ada video contoh di sini.</p>
      </div>
    )
  }
  const iframe = /youtube\.com|youtu\.be|vimeo\.com|tiktok\.com/.test(sumber)
  return (
    <div className="sk-pemutar">
      {iframe ? (
        <iframe src={sumber} title={video.judul || 'Video Streamku'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <video src={sumber} controls preload="metadata" poster={String(video.thumbnail || '').trim() || undefined} aria-label={video.judul || 'Video Streamku'} />
      )}
    </div>
  )
}

// Kartu video; thumbnail hanya bila URL nyata.
export function KartuVideo({ video }) {
  const thumb = String(video?.thumbnail || '').trim()
  const judul = String(video?.judul || '').trim()
  const kreator = String(video?.kreator || '').trim()
  const kategori = String(video?.kategori || '').trim()
  const durasi = String(video?.durasi || '').trim()
  const deskripsi = String(video?.deskripsi || '').trim()
  const tautan = String(video?.url || video?.urlVideo || '').trim()
  const isi = (
    <>
      <div className="sk-thumb sk-thumb-video" aria-hidden="true">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="sk-thumb-ikon"><Ikon nama="siaran" ukuran={30} /></span>
        )}
        {durasi && <span className="sk-durasi">{durasi}</span>}
      </div>
      <div className="sk-badan">
        {kategori && <span className="sk-game">{kategori}</span>}
        {judul && <h3 className="sk-judul">{judul}</h3>}
        {kreator && <p className="sk-streamer">{kreator}</p>}
        {deskripsi && <p className="sk-deskripsi">{deskripsi}</p>}
      </div>
    </>
  )
  if (tautan && /^https?:\/\//.test(tautan)) {
    return <a className="sk-kartu" href={tautan} target="_blank" rel="noreferrer">{isi}</a>
  }
  return <article className="sk-kartu">{isi}</article>
}

// Grid daftar video; kosong = empty state.
export function DaftarVideo({ daftar }) {
  if (!Array.isArray(daftar) || daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon="siaran"
        judul="Belum ada video"
        deskripsi="Daftar video Streamku akan tampil di sini setelah API resmi dihubungkan. Tidak ada video contoh yang ditampilkan."
        teksTombol="Lihat Store"
        tautanTombol="/store"
      />
    )
  }
  return (
    <div className="sk-grid">
      {daftar.map((v) => (<KartuVideo key={v.id || v.judul} video={v} />))}
    </div>
  )
}

// Catatan integrasi API — jujur, tanpa mengarang endpoint/format.
export function CatatanApiStreamku() {
  return (
    <p className="gk-masuk-catatan">
      Integrasi API video: menunggu kontrak resmi (endpoint, format respons, autentikasi, nama field).
      Komponen halaman ini membaca <code>layananStreamku.daftar()</code> sehingga cukup mengganti isi
      layanan tanpa mengubah tampilan. Lihat tautan komunitas nyata di <Link className="tautan-lihat" to="/komunitas">Komunitas</Link>.
    </p>
  )
}
