import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
  '/admin/pengaturan': 'Pengaturan',
}

// Kerangka halaman admin: bilah samping + kepala + isi rute anak.
//
// CATATAN KEAMANAN: belum ada penjaga sesi di sini. Begitu modul PHP
// siap, guard berikut diaktifkan:
//
//   const { sesiServer } = useAdmin()
//   if (!sesiServer) return <Navigate to="/admin/login" replace />
export default function TataLetakAdmin() {
  const { pesan } = useAdmin()
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
