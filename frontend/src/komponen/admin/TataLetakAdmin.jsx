import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Ikon from '../Ikon.jsx'
import BilahSamping from './BilahSamping.jsx'
import KepalaDashboard from './KepalaDashboard.jsx'
import { useAdmin } from '../../konteks/konteksAdmin.js'
import '../../css/admin-utama.css'

// Judul header otomatis mengikuti rute.
const petaJudul = {
  '/admin': 'Dasbor',
  '/admin/produk': 'Produk',
  '/admin/produk/tambah': 'Tambah Produk',
  '/admin/pesanan': 'Pesanan',
  '/admin/pelanggan': 'Pelanggan',
  '/admin/creator': 'Creator',
  '/admin/kategori': 'Kategori',
  '/admin/promo': 'Promo',
  '/admin/ulasan': 'Ulasan',
   '/admin/media': 'Media',
  '/admin/reseller': 'Reseller',
  '/admin/pengaturan': 'Pengaturan',
}

// Kerangka halaman admin: bilah samping + kepala + isi rute anak.
//
// PENJAGA SESI: seluruh rute /admin/* hanya boleh diakses admin dengan sesi
// server valid (cookie HttpOnly). Verifikasi dilakukan backend lewat GET /api/auth/saya.
export default function TataLetakAdmin() {
  const { pesan, sesiServer, memuatSesi } = useAdmin()
  const { pathname } = useLocation()
  // Status drawer "ditanam" pada pathname: saat pathname berubah, nilai
  // turunan di bawah otomatis menutup drawer tanpa setState di effect.
  const [kondisiSidebar, setKondisiSidebar] = useState({
    path: pathname,
    terbuka: false,
  })
  const sidebarTerbuka =
    kondisiSidebar.terbuka && kondisiSidebar.path === pathname

  // Latar tubuh berpindah ke tema admin selama di rute /admin/*.
  useEffect(() => {
    document.body.classList.add('mode-admin')
    return () => document.body.classList.remove('mode-admin')
  }, [])

  // Selagi sesi diperiksa server, tampilkan status memuat (jangan kedip ke login).
  if (memuatSesi) {
    return (
      <div className="admin-aplikasi" role="status" aria-live="polite">
        <div className="admin-memuat-sesi">
          <span className="cb-putar" aria-hidden="true" />
          Memeriksa sesi admin…
        </div>
      </div>
    )
  }

  // Tanpa sesi server valid → paksa ke halaman masuk admin.
  if (!sesiServer) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="admin-aplikasi">
      <BilahSamping
        terbuka={sidebarTerbuka}
        padaTutup={() => setKondisiSidebar((s) => ({ ...s, terbuka: false }))}
      />
      {sidebarTerbuka && (
        <div
          className="tirai-admin"
          onClick={() => setKondisiSidebar((s) => ({ ...s, terbuka: false }))}
          role="presentation"
        />
      )}
      <div className="admin-konten">
        <KepalaDashboard
          judul={petaJudul[pathname] || 'Dasbor'}
          padaBukaSidebar={() =>
            setKondisiSidebar({ path: pathname, terbuka: true })
          }
        />
        <main className="admin-isi">
          <Outlet />
        </main>
      </div>

      {pesan && (
        <div className="toast-admin" role="status">
          <Ikon nama="cek" ukuran={16} />
          {pesan}
        </div>
      )}
    </div>
  )
}
