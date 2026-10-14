// Halaman /streamku — platform video gaming Gameku.store, SIAP API.
//
// SUMBER DATA: layananStreamku (pola sama seperti layanan lain).
// Saat ini daftar KOSONG — halaman menampilkan empty state profesional,
// bukan video/kreator/judul/durasi/penonton/LIVE karangan.
// Filter & sortir DINONAKTIFKAN selama belum ada data (disabled +
// penjelasan), agar tidak ada interaksi yang seolah berfungsi.
import { useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import Ikon from '../komponen/Ikon.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import {
  subscribeStreamku,
  daftarVideo,
  kategoriVideo,
  cariVideo,
} from '../layanan/layananStreamku.js'
import {
  AreaVideoUtama,
  DaftarVideo,
  CatatanApiStreamku,
} from '../komponen/StreamkuTayang.jsx'


const OPSI_URUT = [
  { id: 'terbaru', nama: 'Terbaru' },
  { id: 'judul', nama: 'Judul A–Z' },
]

export default function HalamanStreamku() {
  useSyncExternalStore(subscribeStreamku, daftarVideo, daftarVideo)
  const [kataKunci, setKataKunci] = useState('')
  const [kategori, setKategori] = useState('semua')
  const [urutan, setUrutan] = useState('terbaru')
  useReveal()

  // Data nyata saja. Tanpa data = array kosong (bukan contoh).
  const kategoriAsli = kategoriVideo()
  const hasilCari = cariVideo(kataKunci)
  const adaData = daftarVideo().length > 0

  const daftar = useMemo(() => {
    const hasil = kategori === 'semua'
      ? hasilCari
      : hasilCari.filter((v) => String(v?.kategori || '') === kategori)
    const salin = [...hasil]
    if (urutan === 'judul') {
      salin.sort((a, b) => String(a?.judul || '').localeCompare(String(b?.judul || ''), 'id'))
    }
    return salin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasilCari, kategori, urutan])

  const utama = daftar[0] || null

  return (
    <>
      <section className="kepala-bagian"><div className="wadah sk-kepala-atas">
        <div>
          <span className="lencana lencana-merah"><Ikon nama="siaran" ukuran={13} /> Streamku</span>
          <h1 className="judul-halaman">Streamku</h1>
          <p className="subjudul-halaman">Ruang video gaming Gameku.store — tonton konten kreator, pelajari build, dan temukan produk terkait di Store.</p>
        </div>
        <form className="sk-cari-atas" role="search" onSubmit={(e) => e.preventDefault()}>
          <Ikon nama="cari" ukuran={16} />
          <input
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder={adaData ? 'Cari judul, kreator, kategori…' : 'Pencarian aktif setelah video tersedia'}
            aria-label="Cari video Streamku"
            disabled={!adaData}
          />
        </form>
      </div></section>

      <section className="bagian reveal"><div className="wadah">
        <div className="sk-filter-bar" aria-label="Filter video">
          <div className="sk-pil" role="tablist" aria-label="Kategori video">
            <button type="button" role="tab" aria-selected={kategori === 'semua'} className={kategori === 'semua' ? 'pil pil-aktif' : 'pil'} onClick={() => setKategori('semua')} disabled={!adaData}>Semua</button>
            {kategoriAsli.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kategori === k} className={kategori === k ? 'pil pil-aktif' : 'pil'} onClick={() => setKategori(k)} disabled={!adaData}>{k}</button>
            ))}
          </div>
          <div className="baris-urut">
            <label className="label-isian" htmlFor="urut-video" style={{ margin: 0 }}>Urutkan:</label>
            <select id="urut-video" className="pilih pilih-urut" value={urutan} onChange={(e) => setUrutan(e.target.value)} disabled={!adaData}>
              {OPSI_URUT.map((o) => (<option key={o.id} value={o.id}>{o.nama}</option>))}
            </select>
            <span className="lencana lencana-abu">{daftar.length} video</span>
          </div>
        </div>
        {!adaData && (
          <p className="sk-filter-note" role="note">Filter dan pencarian nonaktif — belum ada data video dari API resmi.</p>
        )}
      </div></section>

      <section className="bagian reveal"><div className="wadah">
        <div className="judul-bagian"><div><h2>Video Utama</h2><p>Rasio 16:9 · terisi otomatis dari API nanti.</p></div></div>
        <AreaVideoUtama video={utama} />
        {utama?.judul && <h3 className="sk-video-judul">{utama.judul}</h3>}
        {(utama?.kreator || utama?.kategori) && (
          <p className="subjudul-halaman">{[utama.kreator, utama.kategori].filter(Boolean).join(' · ')}</p>
        )}
      </div></section>

      <section className="bagian reveal"><div className="wadah">
        <div className="judul-bagian"><div><h2>Daftar Video</h2><p>{adaData ? `${daftar.length} video tersedia.` : 'Menunggu API resmi — tanpa video contoh.'}</p></div></div>
        {adaData ? (
          <DaftarVideo daftar={daftar} />
        ) : (
          <KeadaanKosong
            ikon="siaran"
            judul="Belum ada video Streamku"
            deskripsi="Video, thumbnail, judul, kreator, dan durasi akan tampil di sini setelah API resmi dihubungkan. Halaman ini sengaja tidak menampilkan konten contoh."
            teksTombol="Lihat Store"
            tautanTombol="/store"
          />
        )}
        <div style={{ marginTop: 14 }}><CatatanApiStreamku /></div>
      </div></section>
    </>
  )
}
