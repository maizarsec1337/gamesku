import { Link } from 'react-router-dom'
import KartuStatistik from '../komponen/admin/KartuStatistik.jsx'
import GrafikPenjualan from '../komponen/admin/GrafikPenjualan.jsx'
import TabelPesanan from '../komponen/admin/TabelPesanan.jsx'
import KartuProdukTerlaris from '../komponen/admin/KartuProdukTerlaris.jsx'
import AktivitasTerbaru from '../komponen/admin/AktivitasTerbaru.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { ambilDasbor, daftarPesananApi } from '../layanan/apiAdmin.js'
import '../css/admin-dasbor.css'
import '../css/admin-tabel.css'

const tanggalIni = new Date().toLocaleDateString('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Ikon/warna kartu bersifat dekoratif (bukan data) — ditentukan dari id statistik.
const IKON_STAT = { produk: 'kotak', pesanan: 'pesanan', pelanggan: 'pelanggan', pendapatan: 'dompet' }
const WARNA_STAT = { produk: 'hijau', pesanan: 'hijau', pelanggan: 'biru', pendapatan: 'coklat' }

// Superadmin dashboard — semua statistik berasal dari database sebenarnya.
// Hanya akun yang ditetapkan (gameku.myid@gmail.com) yang boleh mengakses.
const IKON_SUPER = { pengguna: 'pelanggan', reseller: 'dompet', cs: 'chat', produk: 'kotak', pendapatan: 'dompet' }
const WARNA_SUPER = { pengguna: 'biru', reseller: 'hijau', cs: 'coklat', produk: 'hijau', pendapatan: 'coklat' }

const IKON_USER = { pelanggan: 'pelanggan', reseller: 'dompet', cs: 'chat' }
const WARNA_USER = { pelanggan: 'biru', reseller: 'hijau', cs: 'cokbat' }

export default function SuperadminDasbor() {
  const { data, memuat, galat, muat } = useApi(() => ambilDasbor(), [])
  const { data: pesanan } = useApi(() => daftarPesananApi(), [])

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat dasbor…</p>
      </div>
    )
  }

  if (galat) {
    return (
      <div className="pesan-salah-login" role="alert">
        <Ikon nama="info" ukuran={16} />
        {pesanGalat(galat)}
        <button type="button" className="tombol-admin tombol-garis" style={{ marginLeft: 'auto' }} onClick={muat}>
          Coba lagi
        </button>
      </div>
    )
  }

  const statistik = (data?.statistik || []).map((s) => ({
    ...s,
    ikon: IKON_STAT[s.id] || 'kotak',
    warna: WARNA_STAT[s.id] || 'hijau',
  }))

  const terbaru = Array.isArray(pesanan) ? pesanan.slice(0, 6) : []

  return (
    <>{}
      <div className="sambutan-admin">
        <div>
          <h2>Selamat datang di Dasbor Superadmin Gamesku</h2>
          <p>Pantau seluruh operasi toko dan kelola pengguna.</p>
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
          <GrafikPenjualan seri={data?.grafik || []} />
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
              Lihat Semua
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
          <KartuProdukTerlaris peringkat={data?.terlaris || []} />
        </section>
      </div>
    </>
  )
}