// Header Gamesku — biru, sapaan, notifikasi, profil.
// Mobile: search di baris bawah + bottom-nav. Desktop: navigasi atas + search inline.
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import Ikon from './Ikon.jsx'
import { daftarMenu } from '../data/menuNavigasi.js'

export default function Navigasi() {
  const navigasi = useNavigate()
  const [kataKunci, setKataKunci] = useState('')
  const { jumlahItem } = useKeranjang()
  const { jumlahSuka } = useWishlist()

  const kirimCari = (e) => {
    e.preventDefault()
    const rapi = kataKunci.trim()
    navigasi(rapi ? `/store?cari=${encodeURIComponent(rapi)}` : '/store')
  }

  return (
    <header className="kepala">
      <div className="wadah kepala-isi">
        <Link className="logo" to="/" aria-label="Gamesku">
          <span className="logo-gameku" aria-hidden="true">G</span>
          <span className="logo-teks">
            Gamesku
            <small>Halo, Gamer!</small>
          </span>
        </Link>

        {/* Navigasi atas — hanya tampil di desktop (>=1024px) */}
        <nav className="navigasi-atas" aria-label="Navigasi utama">
          {daftarMenu.map((menu) => (
            <NavLink
              key={menu.ke}
              to={menu.ke}
              end={menu.tepat}
              className={({ isActive }) => (isActive ? 'tautan-atas aktif' : 'tautan-atas')}
            >
              {menu.label}
            </NavLink>
          ))}
        </nav>

        {/* Search inline — hanya tampil di desktop (>=1024px) */}
        <form className="cari-kepala" onSubmit={kirimCari} role="search">
          <Ikon nama="cari" ukuran={16} />
          <input
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder="Cari diamond, Robux, voucher..."
            aria-label="Cari produk Gamesku"
          />
        </form>

        <div className="aksi-kepala">
          <Link className="tombol-ikon" to="/berita" aria-label="Notifikasi">
            <Ikon nama="lonceng" ukuran={18} />
          </Link>
          <Link className="tombol-ikon" to="/wishlist" aria-label={`Wishlist (${jumlahSuka})`}>
            <Ikon nama="hati" ukuran={18} />
            {jumlahSuka > 0 && <span className="gelembung">{jumlahSuka}</span>}
          </Link>
          <Link className="tombol-ikon" to="/keranjang" aria-label={`Keranjang (${jumlahItem})`}>
            <Ikon nama="keranjang" ukuran={18} />
            {jumlahItem > 0 && <span className="gelembung">{jumlahItem}</span>}
          </Link>
          <Link className="tombol-profil" to="/profil" aria-label="Profil">
            <Ikon nama="pengguna" ukuran={18} />
          </Link>
        </div>
      </div>

      {/* Search mobile — disembunyikan di desktop */}
      <div className="wadah baris-cari-mobile">
        <form className="cari-mobile" onSubmit={kirimCari} role="search">
          <Ikon nama="cari" ukuran={16} />
          <input
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder="Cari diamond, Robux, voucher..."
            aria-label="Cari produk Gamesku"
          />
        </form>
      </div>
    </header>
  )
}

