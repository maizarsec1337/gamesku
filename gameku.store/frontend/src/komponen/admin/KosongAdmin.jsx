import { Link } from 'react-router-dom'
import Ikon from '../Ikon.jsx'
import '../../css/admin-tabel.css'

// =====================================================================
// KOSONG ADMIN — tampilan standar saat belum ada data.
//
// Dipakai semua halaman admin. Bukan tabel kosong yang rusak, melainkan
// kotak yang jelas: ikon, judul, penjelasan, dan tombol aksi.
//
//   <KosongAdmin
//     ikon="kotak"
//     judul="Belum ada produk"
//     deskripsi="Tambahkan produk pertama untuk mulai mengisi Gamesku."
//     aksi={{ label: '+ Tambah Produk', ke: '/admin/produk/tambah' }}
//   />
// =====================================================================
export default function KosongAdmin({
  ikon = 'kotak',
  judul = 'Belum ada data',
  deskripsi = '',
  aksi = null,
  Children = null,
}) {
  return (
    <div className="panel-badan">
      <div className="keadaan-kosong keadaan-kosong-admin">
        <div className="keadaan-kosong-ikon keadaan-kosong-ikon-admin">
          <Ikon nama={ikon} ukuran={30} />
        </div>
        <h3>{judul}</h3>
        {deskripsi && <p>{deskripsi}</p>}
        {Children}

        {aksi && (
          <div className="keadaan-kosong-aksi">
            {aksi.ke ? (
              <Link className="tombol-admin tombol-hijau" to={aksi.ke}>
                <Ikon nama="tambah" ukuran={16} />
                {aksi.label}
              </Link>
            ) : (
              <button type="button" className="tombol-admin tombol-hijau" onClick={aksi.onKlik}>
                <Ikon nama={aksi.ikon || 'tambah'} ukuran={16} />
                {aksi.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
