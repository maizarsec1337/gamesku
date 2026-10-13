import { Link } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import KartuStatistik from '../komponen/admin/KartuStatistik.jsx'
import GrafikPenjualan from '../komponen/admin/GrafikPenjualan.jsx'
import TabelPesanan from '../komponen/admin/TabelPesanan.jsx'
import KartuProdukTerlaris from '../komponen/admin/KartuProdukTerlaris.jsx'
import AktivitasTerbaru from '../komponen/admin/AktivitasTerbaru.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { ringkasanDasbor, subscribeDasbor } from '../layanan/layananDasbor.js'
import '../css/admin-dasbor.css'
import '../css/admin-tabel.css'

const tanggalIni = new Date().toLocaleDateString('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// =====================================================================
// Dasbor utama admin (/admin).
//
// Semua angka berasal dari layananDasbor yang menghitungnya dari data
// nyata. Database kosong => Produk 0, Pesanan 0, Pelanggan 0, Pendapatan
// Rp 0 — bukan angka contoh.
// =====================================================================
export default function AdminDasbor() {
  // Semua kartu dasbor membaca satu snapshot yang sama, sehingga
  // statistik / grafik / pesanan / produk terlaris selalu sinkron.
  const { statistik, terbaru } = useSyncExternalStore(
    subscribeDasbor,
    ringkasanDasbor,
    ringkasanDasbor,
  )

  return (
    <>
      <div className="sambutan-admin">
        <div>
          <h2>Selamat datang di Dasbor gamesku</h2>
          <p>Pantau katalog, kategori, dan transaksi toko.</p>
        </div>
        <span className="sambutan-periode">
          <Ikon nama="kalender" ukuran={15} />
          Hari ini, {tanggalIni}
        </span>
      </div>

      <div className="kisi-statistik">
        {statistik.map((s) => (
          <KartuStatistik key={s.id} {...s} />
        ))}
      </div>

      <div className="kisi-dasbor">
        <div className="span-2">
          <GrafikPenjualan />
        </div>

        <section className="kartu-panel">
          <div className="panel-kepala">
            <div>
              <h3 className="panel-judul">Aktivitas Terbaru</h3>
              <p className="panel-sub">Peristiwa terkini di toko</p>
            </div>
            <Ikon nama="jam" ukuran={17} />
          </div>
          <AktivitasTerbaru />
        </section>

        <section className="kartu-panel span-2">
          <div className="panel-kepala">
            <div>
              <h3 className="panel-judul">Pesanan Terbaru</h3>
              <p className="panel-sub">Transaksi terakhir masuk</p>
            </div>
            <Link className="panel-tautan" to="/admin/pesanan">
              Lihat semua
              <Ikon nama="panahKanan" ukuran={14} />
            </Link>
          </div>
          <TabelPesanan
            pesanan={terbaru}
            kosong={
              <KosongAdmin
                ikon="pesanan"
                judul="Belum ada pesanan."
                deskripsi="Pesanan pelanggan akan muncul di sini."
              />
            }
          />
        </section>

        <section className="kartu-panel">
          <div className="panel-kepala">
            <div>
              <h3 className="panel-judul">Produk Terlaris</h3>
              <p className="panel-sub">Peringkat penjualan</p>
            </div>
            <Link className="panel-tautan" to="/admin/produk">
              Produk
              <Ikon nama="panahKanan" ukuran={14} />
            </Link>
          </div>
          <KartuProdukTerlaris />
        </section>
      </div>
    </>
  )
}
