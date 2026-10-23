import { Route, Routes } from 'react-router-dom'
import GulirKeAtas from './komponen/GulirKeAtas.jsx'
import TataLetak from './komponen/TataLetak.jsx'
import Beranda from './halaman/Beranda.jsx'
import Store from './halaman/Store.jsx'
import HalamanDetailProduk from './halaman/DetailProduk.jsx'
import HalamanKategori from './halaman/Kategori.jsx'
import HalamanGratis from './halaman/Gratis.jsx'
import HalamanPromo from './halaman/Promo.jsx'
import HalamanStreamku from './halaman/Streamku.jsx'
import HalamanDetailAnime from './halaman/DetailAnime.jsx'
import HalamanKeranjang from './halaman/Keranjang.jsx'
import HalamanWishlist from './halaman/Wishlist.jsx'
import HalamanProfil from './halaman/Profil.jsx'
import HalamanMasuk from './halaman/Masuk.jsx'
import HalamanReseller from './halaman/ResellerAjuan.jsx'
import DasborReseller from './halaman/DasborReseller.jsx'
import HalamanBantuan from './halaman/Bantuan.jsx'
import TidakDitemukan from './halaman/TidakDitemukan.jsx'
// Rute admin Gamesku (dashboard CMS).
import TataLetakAdmin from './komponen/admin/TataLetakAdmin.jsx'
import AdminLogin from './halaman-admin/AdminLogin.jsx'
import AdminDasbor from './halaman-admin/AdminDasbor.jsx'
import AdminProduk from './halaman-admin/AdminProduk.jsx'
import AdminProdukTambah from './halaman-admin/AdminProdukTambah.jsx'
import AdminPesanan from './halaman-admin/AdminPesanan.jsx'
import AdminPelanggan from './halaman-admin/AdminPelanggan.jsx'
import AdminCreator from './halaman-admin/AdminCreator.jsx'
import AdminKategori from './halaman-admin/AdminKategori.jsx'
import AdminPromo from './halaman-admin/AdminPromo.jsx'
import AdminUlasan from './halaman-admin/AdminUlasan.jsx'
import AdminMedia from './halaman-admin/AdminMedia.jsx'
import AdminPengaturan from './halaman-admin/AdminPengaturan.jsx'
import AdminReseller from './halaman-admin/AdminReseller.jsx'
import SuperadminDasbor from './halaman-admin/SuperadminDasbor.jsx'
import SuperadminPengguna from './halaman-admin/SuperadminPengguna.jsx'
import SuperadminAudit from './halaman-admin/SuperadminAudit.jsx'

// Rute aplikasi (admin + toko depan).
export default function App() {
  return (
    <>
      <GulirKeAtas />
      <Routes>
        {/* Rute admin. */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<TataLetakAdmin />}>
          <Route index element={<AdminDasbor />} />
          <Route path="produk" element={<AdminProduk />} />
          <Route path="produk/tambah" element={<AdminProdukTambah />} />
          <Route path="pesanan" element={<AdminPesanan />} />
          <Route path="pelanggan" element={<AdminPelanggan />} />
          <Route path="superadmin" element={<SuperadminDasbor />} />
          <Route path="superadmin/pengguna" element={<SuperadminPengguna />} />
          <Route path="superadmin/audit" element={<SuperadminAudit />} />
          <Route path="creator" element={<AdminCreator />} />
          <Route path="kategori" element={<AdminKategori />} />
          <Route path="promo" element={<AdminPromo />} />
          <Route path="ulasan" element={<AdminUlasan />} />
          <Route path="media" element={<AdminMedia />} />
          <Route path="reseller" element={<AdminReseller />} />
          <Route path="pengaturan" element={<AdminPengaturan />} />
        </Route>

        {/* Marketplace (toko depan). */}
        <Route path="/masuk" element={<HalamanMasuk />} />
        <Route element={<TataLetak />}>
          <Route path="/" element={<Beranda />} />
          <Route path="/store" element={<Store />} />
          <Route path="/produk/:slug" element={<HalamanDetailProduk />} />
          <Route path="/kategori" element={<HalamanKategori />} />
          <Route path="/kategori/:slug" element={<HalamanKategori />} />
          <Route path="/gratis" element={<HalamanGratis />} />
          <Route path="/promo" element={<HalamanPromo />} />
          <Route path="/streamku" element={<HalamanStreamku />} />
          <Route path="/streamku/:slug" element={<HalamanDetailAnime />} />
          <Route path="/keranjang" element={<HalamanKeranjang />} />
          <Route path="/wishlist" element={<HalamanWishlist />} />
          <Route path="/profil" element={<HalamanProfil />} />
          <Route path="/profil/reseller" element={<HalamanReseller />} />
          <Route path="/profil/reseller/dashboard" element={<DasborReseller />} />
          <Route path="/bantuan" element={<HalamanBantuan />} />
          <Route path="/kreator" element={<HalamanBantuan />} />
          <Route path="/syarat" element={<HalamanBantuan />} />
          <Route path="/privasi" element={<HalamanBantuan />} />
          <Route path="/komunitas" element={<HalamanBantuan />} />
          <Route path="/event" element={<HalamanBantuan />} />
          <Route path="/berita" element={<HalamanBantuan />} />
          <Route path="*" element={<TidakDitemukan />} />
        </Route>
      </Routes>
    </>
  )
}
