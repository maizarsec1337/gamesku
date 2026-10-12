// Halaman 404 RAK VIN.
import { Link } from 'react-router-dom'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'

export default function TidakDitemukan() {
  return (
    <section className="bagian">
      <div className="wadah">
        <KeadaanKosong
          ikon="cari"
          judul="Halaman tidak ditemukan"
          deskripsi="Alamat ini tidak ada di RAK VIN. Kembali dan lanjutkan main."
          teksTombol="Kembali ke RAK VIN"
          tautanTombol="/"
          aksi={
            <Link className="tombol tombol-garis tombol-kecil" to="/store">
              Lihat Store
            </Link>
          }
        />
      </div>
    </section>
  )
}


