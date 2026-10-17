// Teaser Streamku di Home — ringkas + 3 kartu anime asli (tanpa data contoh).
// Kartu memakai komponen yang sama dengan halaman /streamku (KartuAnime) supaya
// poster portrait, judul, badge, border, dan hover-nya konsisten tanpa duplikasi.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import { katalogAnime } from '../layanan/layananAnime.js'
import { KartuAnime } from './StreamkuTayang.jsx'

export default function Streamku() {
  const [daftar, setDaftar] = useState([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let batal = false
    katalogAnime({ per: 3 })
      .then((d) => {
        if (batal) return
        setDaftar(Array.isArray(d?.items) ? d.items.slice(0, 3) : [])
        setTotal(Number(d?.total || 0))
      })
      .catch(() => { if (!batal) setDaftar([]) })
    return () => { batal = true }
  }, [])

  return (
    <section className="reveal" aria-label="Streamku">
      <div className="streamku streamku-ringkas">
        <div className="streamku-atas">
          <div>
            <span className="lencana lencana-kuning">Streamku</span>
            <h2 style={{ marginTop: 8 }}>Tonton &amp; telusuri anime</h2>
            <p>{total > 0 ? `${total} seri tersedia di katalog.` : 'Katalog anime Gameku.store beserta daftar episodenya.'}</p>
          </div>
          <Link className="cta" to="/streamku"><Ikon nama="siaran" ukuran={15} /> Buka Streamku</Link>
        </div>
        {daftar.length > 0 && (
          <div className="streamku-mini">
            {daftar.map((s) => (<KartuAnime key={s.slug} seri={s} />))}
          </div>
        )}
      </div>
    </section>
  )
}

