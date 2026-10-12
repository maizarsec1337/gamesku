// Bagian produk reusable — judul + grid KartuProduk.
import { Link } from 'react-router-dom'
import KartuProduk from './KartuProduk.jsx'
import Ikon from './Ikon.jsx'

export default function BagianProduk({ judul, subjudul, daftar = [], tautan, teksTautan = 'Lihat Semua' }) {
  if (!daftar.length) return null
  return (
    <section className="bagian">
      <div className="wadah">
        <div className="judul-bagian">
          <div>
            <h2>{judul}</h2>
            {subjudul && <p>{subjudul}</p>}
          </div>
          {tautan && <Link className="tautan-lihat" to={tautan}>{teksTautan}<Ikon nama="panahKanan" ukuran={14} /></Link>}
        </div>
        <div className="kisi-produk bagian-produk">
          {daftar.map((produk) => (<KartuProduk key={produk.id} produk={produk} />))}
        </div>
      </div>
    </section>
  )
}
