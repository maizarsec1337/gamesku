// Komponen presentasi Streamku (katalog anime). Semua field dirender hanya bila
// benar-benar ada di data backend — tidak ada poster/judul/episode karangan.
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import KeadaanKosong from './KeadaanKosong.jsx'

// Kerangka muat (skeleton) saat data sedang diambil.
export function MuatKerangka({ jumlah = 8 }) {
  return (
    <div className="sk-grid" aria-hidden="true">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="sk-kartu sk-kerangka">
          <div className="sk-thumb sk-thumb-video" />
          <div className="sk-badan">
            <span className="sk-garis-teks" />
            <span className="sk-garis-teks sk-garis-pendek" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Kartu anime: poster asli + judul + jumlah episode; menuju halaman detail.
export function KartuAnime({ seri }) {
  const poster = String(seri?.gambar || '').trim()
  const judul = String(seri?.judul || '').trim()
  const jumlahEps = Number(seri?.jumlahEpisode || 0)
  return (
    <Link className="sk-kartu" to={`/streamku/${encodeURIComponent(seri.slug)}`} aria-label={judul || 'Detail anime'}>
      <div className="sk-thumb sk-thumb-video">
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <span className="sk-thumb-ikon"><Ikon nama="siaran" ukuran={30} /></span>
        )}
        {jumlahEps > 0 && <span className="sk-durasi">{jumlahEps} eps</span>}
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
export function BarisEpisode({ episode }) {
  const no = Number(episode?.no || 0)
  const judul = String(episode?.judul || '').trim()
  const tautan = String(episode?.link || '').trim()
  const tanggal = formatTanggal(episode?.tanggal)
  const aman = /^https?:\/\//.test(tautan)
  return (
    <li className="sk-eps">
      <span className="sk-eps-no">{no ? `Eps ${no}` : '—'}</span>
      <span className="sk-eps-judul">
        {judul || `Episode ${no}`}
        {tanggal && <span className="sk-eps-tanggal">{tanggal}</span>}
      </span>
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
export function formatTanggal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
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
