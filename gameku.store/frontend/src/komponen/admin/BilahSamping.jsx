import { NavLink, useNavigate } from 'react-router-dom'
import Ikon from '../Ikon.jsx'
import { useAdmin } from '../../konteks/konteksAdmin.js'
import { useDaftar } from '../../layanan/gunakanDaftar.js'
import layananPesanan from '../../layanan/layananPesanan.js'
import layananUlasan from '../../layanan/layananUlasan.js'
import { STATUS_ULASAN } from '../../data/konstanta.js'

// Struktur menu bilah samping, dipisah per section.
// Badge hanya muncul bila datanya benar-benar ada (hitung dari service).
const seksiMenu = [
  {
    judul: 'Utama',
    tautan: [
      { teks: 'Dasbor', ke: '/admin', ikon: 'dasbor', akhir: true },
      { teks: 'Pesanan', ke: '/admin/pesanan', ikon: 'pesanan', hitung: 'pesanan' },
      { teks: 'Pelanggan', ke: '/admin/pelanggan', ikon: 'pelanggan' },
    ],
  },
  {
    judul: 'Toko',
    tautan: [
      { teks: 'Produk', ke: '/admin/produk', ikon: 'kotak' },
      { teks: 'Kategori', ke: '/admin/kategori', ikon: 'kategori' },
      { teks: 'Creator', ke: '/admin/creator', ikon: 'kreator' },
      { teks: 'Promo', ke: '/admin/promo', ikon: 'promo' },
      { teks: 'Ulasan', ke: '/admin/ulasan', ikon: 'ulasan', hitung: 'ulasan' },
      { teks: 'Media', ke: '/admin/media', ikon: 'media' },
    ],
  },
  {
    judul: 'Sistem',
    tautan: [{ teks: 'Pengaturan', ke: '/admin/pengaturan', ikon: 'pengaturan' }],
  },
]

// Bilah samping (sidebar) admin — fixed di desktop, drawer di mobile.
export default function BilahSamping({ terbuka = false, padaTutup = () => {} }) {
  const { keluar } = useAdmin()
  const navigate = useNavigate()

  // Badge dihitung dari data nyata; 0 = tidak ditampilkan.
  const jumlahPesanan = useDaftar(layananPesanan).length
  const jumlahUlasan = useDaftar(layananUlasan).filter(
    (u) => u.status === STATUS_ULASAN[0],
  ).length
  const hitungan = { pesanan: jumlahPesanan, ulasan: jumlahUlasan }

  const akhiriSesi = () => {
    keluar()
    navigate('/admin/login', { replace: true })
  }

  return (
    <aside className={`bilah-samping ${terbuka ? 'terbuka' : ''}`}>
      <div className="bilah-logo">
        <span className="bilah-logo-kubus">G</span>
        <span className="bilah-logo-teks">
          <strong>Gamesku</strong>
          <span>Panel Admin</span>
        </span>
        <button
          type="button"
          className="bilah-tutup"
          onClick={padaTutup}
          aria-label="Tutup menu"
        >
          <Ikon nama="tutup" ukuran={18} />
        </button>
      </div>

      <nav className="bilah-menu" aria-label="Menu admin">
        {seksiMenu.map((seksi) => (
          <div key={seksi.judul}>
            <div className="bilah-seksi">{seksi.judul}</div>
            {seksi.tautan.map((tautan) => (
              <NavLink
                key={tautan.ke}
                to={tautan.ke}
                end={tautan.akhir}
                className={({ isActive }) =>
                  `bilah-tautan ${isActive ? 'aktif' : ''}`
                }
              >
                <Ikon nama={tautan.ikon} ukuran={17.5} />
                <span>{tautan.teks}</span>
                {tautan.hitung && hitungan[tautan.hitung] > 0 && (
                  <span className="lencana-jumlah">{hitungan[tautan.hitung]}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="bilah-profil">
        {/* Identitas admin berasal dari server (session PHP). Selama belum
            ada server, panel hanya menampilkan peran, bukan nama akun. */}
        <span className="avatar-admin">A</span>
        <span className="bilah-profil-teks">
          <strong>Administrator</strong>
          <span>Belum terhubung</span>
        </span>
        <button
          type="button"
          className="bilah-keluar"
          onClick={akhiriSesi}
          data-tip="Keluar"
          aria-label="Keluar dari sesi admin"
        >
          <Ikon nama="keluar" ukuran={17} />
        </button>
      </div>
    </aside>
  )
}
