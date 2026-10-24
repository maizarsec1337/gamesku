import { Link } from 'react-router-dom'
import { Gamepad2, Sparkles, Box, Layers3, ArrowUpRight } from 'lucide-react'

export default function BannerUtama() {
  return (
    <section className="wadah arena-hero" aria-label="Sorotan Gamesku">
      <div className="arena-panggung">
        <div className="arena-pesan">
          <span className="arena-eyebrow"><span /> YOUR NEXT PLAY STARTS HERE</span>
          <h1>Game favoritmu.<br />Gaya <em>kamu.</em></h1>
          <p>Temukan skin, item, dan dunia baru untuk petualangan berikutnya. Satu tempat untuk semua hal yang bikin main makin seru.</p>
          <div className="arena-aksi">
            <Link className="tombol tombol-utama" to="/store">Jelajahi item <ArrowUpRight size={18} /></Link>
            <Link className="arena-link" to="/gratis">Mulai dari yang gratis <span>→</span></Link>
          </div>
          <div className="arena-tags"><span>SKINS</span><i /><span>MAPS</span><i /><span>ADD-ONS</span><i /><span>MORE POSSIBILITIES</span></div>
        </div>
        <div className="arena-art" aria-hidden="true">
          <div className="arena-orbit" /><span className="arena-art-label">THE GAMESKU COLLECTION</span>
          <div className="arena-item arena-item-belakang"><Layers3 size={42} /><span>NEW WORLDS</span><strong>Explore<br />without limits.</strong></div>
          <div className="arena-item arena-item-utama"><span className="arena-item-top">G / EQUIP YOUR NEXT ADVENTURE <Sparkles size={16} /></span><Gamepad2 className="arena-gamepad" size={164} strokeWidth={1.2} /><div><span>READY TO PLAY</span><strong>Level up<br />your world.</strong></div><span className="arena-item-bottom">GAMESKU ORIGINAL SPIRIT <ArrowUpRight size={25} /></span></div>
          <div className="arena-loot"><Box size={22} /><div><strong>Small items.</strong><span>Big possibilities.</span></div><Sparkles size={16} /></div>
          <span className="arena-art-index">EST. FOR THE PLAYERS / 001</span>
        </div>
      </div>
    </section>
  )
}
