import { NavLink, useNavigate } from 'react-router-dom'
import Ikon from '../Ikon.jsx'
import { useAdmin } from '../../konteks/konteksAdmin.js'
import { useApi } from '../../layanan/gunakanApi.js'
import { daftarPesananApi, daftarUlasanApi } from '../../layanan/apiAdmin.js'

// Struktur menu bilah samping, dipisah per section.
// Badge hanya muncul bila datanya benar-benar ada (dihitung dari server).
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
    tautan: [
      { teks: 'Pengaturan', ke: '/admin/pengaturan', ikon: 'pengaturan' },
      { teks: 'Reseller', ke: '/admin/reseller', ikon: 'dompet' },
    ],
  },
]

// Bilah samping (sidebar) admin — fixed di desktop, drawer di mobile.
export default function BilahSamping({ terbuka = false, padaTutup = () => {} }) {
  const { keluar, sesiServer, isSuperadmin } = useAdmin()
  const navigate = useNavigate()

  // Badge dihitung dari data server (bukan data contoh). Gagal muat = 0.
  const { data: pesanan } = useApi(() => daftarPesananApi(), [])
  const { data: ulasan } = useApi(() => daftarUlasanApi(), [])
  const hitungan = {
    pesanan: Array.isArray(pesanan) ? pesanan.length : 0,
    ulasan: Array.isArray(ulasan) ? ulasan.filter((u) => u.status === 'Menunggu').length : 0,
  }

  const namaAdmin = sesiServer?.nama || sesiServer?.pengguna || 'Administrator'
  const labelPeran = isSuperadmin ? 'Super Admin' : 'Admin'

  const akhiriSesi = async () => {
    await keluar()
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
        {/* Identitas admin berasal dari sesi server (cookie PHP). */}
        <span className="avatar-admin">{(namaAdmin[0] || 'A').toUpperCase()}</span>
        <span className="bilah-profil-teks">
          <strong>{namaAdmin}</strong>
          <span>{labelPeran}</span>
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
