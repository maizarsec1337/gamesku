import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'

// Tampilan saat daftar kosong — ikon profesional (tanpa emoji).
export default function KeadaanKosong({
  ikon = 'cari',
  judul,
  deskripsi,
  teksTombol,
  tautanTombol,
  aksi,
}) {
  return (
    <div className="keadaan-kosong">
      <div className="keadaan-kosong-ikon" aria-hidden="true" style={{ display: 'grid', placeItems: 'center', color: '#43DDF5' }}>
        {typeof ikon === 'string' ? <Ikon nama={ikon} ukuran={40} /> : ikon}
      </div>
      <h3>{judul}</h3>
      <p>{deskripsi}</p>

      {(tautanTombol || aksi) && (
        <div className="keadaan-kosong-aksi">
          {tautanTombol && (
            <Link className="tombol tombol-utama tombol-kecil" to={tautanTombol}>
              {teksTombol}
            </Link>
          )}
          {aksi}
        </div>
      )}
    </div>
  )
}

