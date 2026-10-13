// Footer marketplace — Store, Support, Community, legal.
import { Link } from 'react-router-dom'
import '../css/kaki.css'

const kolomTautan = [
  { judul: 'Store', tautan: [{ ke: '/store', label: 'Semua Produk' }, { ke: '/kategori', label: 'Kategori' }, { ke: '/gratis', label: 'Konten Gratis' }, { ke: '/promo', label: 'Promo' }] },
  { judul: 'Support', tautan: [{ ke: '/bantuan', label: 'Bantuan' }, { ke: '/keranjang', label: 'Keranjang' }, { ke: '/wishlist', label: 'Wishlist' }, { ke: '/profil', label: 'Akun Saya' }] },
  { judul: 'Community', tautan: [{ ke: '/kreator', label: 'Kreator' }, { ke: '/komunitas', label: 'Komunitas' }, { ke: '/event', label: 'Event' }, { ke: '/berita', label: 'Berita' }] },
]

export default function Footer() {
  return (
    <footer className="kaki">
      <div className="wadah kaki-isi">
        <div className="kaki-utama">
          <div className="kaki-merek">
            <span className="logo-mini"><span className="logo-gamesku" style={{width:26,height:26,fontSize:15}} aria-hidden="true">G</span>Gamesku</span>
            <p>Gaming store — top-up, voucher, dan konten digital dari kreator kurasi. Cepat, aman, instan.</p>
            <div className="kaki-sosial">
              <a href="https://discord.gg/gamesku" target="_blank" rel="noreferrer" aria-label="Discord">Discord</a>
              <a href="https://youtube.com/@gamesku" target="_blank" rel="noreferrer" aria-label="YouTube">YouTube</a>
              <a href="https://tiktok.com/@gamesku" target="_blank" rel="noreferrer" aria-label="TikTok">TikTok</a>
            </div>
          </div>
          {kolomTautan.map((kolom) => (
            <nav key={kolom.judul} className="kaki-kolom" aria-label={kolom.judul}>
              <h3>{kolom.judul}</h3>
              <ul>{kolom.tautan.map((t) => (<li key={t.label}><Link to={t.ke}>{t.label}</Link></li>))}</ul>
            </nav>
          ))}
        </div>
        <div className="kaki-bawah">
          <span>© 2026 Gamesku — gaming store.</span>
          <span className="kaki-legal"><Link to="/syarat">Terms</Link> · <Link to="/privasi">Privacy</Link></span>
        </div>
      </div>
    </footer>
  )
}
