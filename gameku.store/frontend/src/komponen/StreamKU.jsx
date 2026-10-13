// Streamku — layanan streaming terpisah dari katalog produk Gamesku.
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'

export default function Streamku() {
  return (
    <section className="reveal" aria-label="Streamku">
      <div className="streamku">
        <span className="lencana lencana-kuning">● LIVE · Streamku</span>
        <h2 style={{ marginTop: 8 }}>Nonton streamer favoritmu</h2>
        <p>Streamku adalah layanan streaming terpisah — nonton live, dukung kreator, dan top-up langsung dari stream.</p>
        <Link className="cta" to="/berita"><Ikon nama="unduhCepat" ukuran={15} /> Buka Streamku</Link>
      </div>
    </section>
  )
}
