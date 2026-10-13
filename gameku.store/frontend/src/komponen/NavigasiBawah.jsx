import { NavLink } from 'react-router-dom'
import { daftarMenu } from '../data/menuNavigasi.js'
import '../css/navigasi.css'

const ikon = {
  beranda: (<><path d="M4 10.6 12 4.2l8 6.4" /><path d="M6.3 10.2v9.6h11.4v-9.6" /></>),
  kategori: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 12h16M12 4v16" /></>),
  gratis: (<><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M6 7.5h.01M6 16.5h.01" /></>),
  store: (<><path d="M5.2 8h13.6l-1.1 11.1a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8Z" /><path d="M9 8V6.6a3 3 0 0 1 6 0V8" /></>),
  profil: (<><circle cx="12" cy="8.4" r="3.6" /><path d="M5 20.2a7 7 0 0 1 14 0" /></>),
}

// Navigasi bawah mobile: Home, Store, Kategori, Gratis, Profil.
export default function NavigasiBawah() {
  return (
    <nav className="navigasi-bawah" aria-label="Navigasi bawah">
      {daftarMenu.map((menu) => (
        <NavLink key={menu.ke} to={menu.ke} end={menu.tepat} className={({ isActive }) => (isActive ? 'menu-bawah menu-bawah-aktif' : 'menu-bawah')}>
          <span className="menu-bawah-ikon"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ikon[menu.ikon]}</svg></span>
          <span className="menu-bawah-label">{menu.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
