// Header RAK VIN — biru, sapaan, notifikasi, profil, search mobile.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import Ikon from './Ikon.jsx'

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
        <Link className="logo" to="/" aria-label="RAK VIN">
          <span className="logo-gameku" aria-hidden="true">R</span>
          <span className="logo-teks">
            RAK VIN
            <small>Halo, Gamer!</small>
          </span>
        </Link>

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

      <div className="wadah baris-cari-mobile">
        <form className="cari-mobile" onSubmit={kirimCari} role="search">
          <Ikon nama="cari" ukuran={16} />
          <input
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder="Cari diamond, Robux, voucher..."
            aria-label="Cari produk RAK VIN"
          />
        </form>
      </div>
    </header>
  )
}

