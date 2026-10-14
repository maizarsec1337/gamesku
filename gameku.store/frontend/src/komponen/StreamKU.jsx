// Teaser Streamku di Home — tanpa klaim data.
// Jumlah diambil dari layananStreamku (saat ini 0 = teks netral).
import { Link } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import Ikon from './Ikon.jsx'
import { subscribeStreamku, daftarVideo } from '../layanan/layananStreamku.js'

export default function Streamku() {
  useSyncExternalStore(subscribeStreamku, daftarVideo, daftarVideo)
  const jumlah = daftarVideo().length
  return (
    <section className="reveal" aria-label="Streamku">
      <div className="streamku">
        <span className="lencana lencana-kuning">Streamku</span>
        <h2 style={{ marginTop: 8 }}>Ruang video gaming</h2>
        <p>{jumlah === 0 ? 'Koleksi video Streamku segera hadir setelah API resmi dihubungkan.' : `${jumlah} video tersedia di Streamku.`}</p>
        <Link className="cta" to="/streamku"><Ikon nama="siaran" ukuran={15} /> Buka Streamku</Link>
      </div>
    </section>
  )
}
