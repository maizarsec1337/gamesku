// StreamKU — layanan streaming terpisah dari katalog produk GameKU.
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'

export default function StreamKU() {
  return (
    <section className="reveal" aria-label="StreamKU">
      <div className="streamku">
        <span className="lencana lencana-kuning">● LIVE · StreamKU</span>
        <h2 style={{ marginTop: 8 }}>Nonton streamer favoritmu</h2>
        <p>StreamKU adalah layanan streaming terpisah — nonton live, dukung kreator, dan top-up langsung dari stream.</p>
        <Link className="cta" to="/berita"><Ikon nama="unduhCepat" ukuran={15} /> Buka StreamKU</Link>
      </div>
    </section>
  )
}
