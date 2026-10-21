import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Ikon from '../Ikon.jsx'
import { useAdmin } from '../../konteks/konteksAdmin.js'
import { useApi } from '../../layanan/gunakanApi.js'
import { daftarPesananApi, daftarUlasanApi, daftarProdukApi } from '../../layanan/apiAdmin.js'
import { waktuRelatif } from '../../data/konstanta.js'

const tanggalHariIni = new Date().toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Kepala (header) dashboard: judul halaman, pencarian, notifikasi, profil.
export default function KepalaDashboard({ judul, padaBukaSidebar = () => {} }) {
  const [notifTerbuka, setNotifTerbuka] = useState(false)
  const [profilTerbuka, setProfilTerbuka] = useState(false)
  const [kataCari, setKataCari] = useState('')
  const areaKepala = useRef(null)
  const navigate = useNavigate()
  const { keluar, sesiServer, isSuperadmin } = useAdmin()

  // Notifikasi disusun dari data server nyata (bukan daftar karangan).
  const { data: pesanan } = useApi(() => daftarPesananApi({ batas: 3 }), [])
  const { data: ulasan } = useApi(() => daftarUlasanApi(), [])
  const { data: produk } = useApi(() => daftarProdukApi({ batas: 200 }), [])

  const notifikasi = [
    ...(Array.isArray(pesanan) ? pesanan.slice(0, 3) : []).map((p) => ({
      kunci: `pesanan-${p.id}`,
      ikon: 'pesanan',
      teks: `Pesanan ${p.id} — ${p.pelanggan || 'pembeli'}`,
      waktu: waktuRelatif(p.dibuatPada),
    })),
    ...(Array.isArray(ulasan) ? ulasan.filter((u) => u.status === 'Menunggu').slice(0, 3) : []).map((u) => ({
      kunci: `ulasan-${u.id}`,
      ikon: 'ulasan',
      teks: `Ulasan "${u.produk}" menunggu moderasi`,
      waktu: waktuRelatif(u.dibuatPada),
    })),
    ...(Array.isArray(produk) ? produk.filter((p) => p.status === 'Draft').slice(0, 3) : []).map((p) => ({
      kunci: `produk-${p.id}`,
      ikon: 'kotak',
      teks: `Produk "${p.nama}" masih berstatus Draft`,
      waktu: waktuRelatif(p.dibuatPada),
    })),
  ]

  // Klik di luar area kepala menutup semua dropdown.
  useEffect(() => {
    const klikLuar = (e) => {
      if (areaKepala.current && !areaKepala.current.contains(e.target)) {
        setNotifTerbuka(false)
        setProfilTerbuka(false)
      }
    }
    document.addEventListener('mousedown', klikLuar)
    return () => document.removeEventListener('mousedown', klikLuar)
  }, [])

  const cari = (e) => {
    e.preventDefault()
    setNotifTerbuka(false)
    setProfilTerbuka(false)
    const q = kataCari.trim()
    navigate(q ? `/admin/produk?cari=${encodeURIComponent(q)}` : '/admin/produk')
  }

  const akhiriSesi = async () => {
    setProfilTerbuka(false)
    await keluar()
    navigate('/admin/login', { replace: true })
  }

  const namaAdmin = sesiServer?.nama || sesiServer?.pengguna || 'Administrator'
  const labelPeran = isSuperadmin ? 'Super Admin' : 'Admin'

  return (
    <header className="kepala-dashboard">
      <div className="kepala-kiri">
        <button
          type="button"
          className="kepala-burger"
          onClick={padaBukaSidebar}
          aria-label="Buka menu samping"
        >
          <Ikon nama="menu" ukuran={20} />
        </button>
        <h1 className="kepala-judul">{judul}</h1>
        <span className="kepala-tanggal">{tanggalHariIni}</span>
      </div>

      <div className="kepala-kanan" ref={areaKepala}>
        <form className="cari-admin" onSubmit={cari} role="search">
          <Ikon nama="cari" ukuran={16} />
          <input
            type="search"
            value={kataCari}
            onChange={(e) => setKataCari(e.target.value)}
            placeholder="Cari produk, pesanan…"
            aria-label="Pencarian admin"
          />
        </form>

        <div className="jungkit-bungkus">
          <button
            type="button"
            className="kepala-ikon"
            onClick={() => {
              setNotifTerbuka((v) => !v)
              setProfilTerbuka(false)
            }}
            aria-label="Notifikasi"
            aria-expanded={notifTerbuka}
          >
            <Ikon nama="lonceng" ukuran={18} />
            {notifikasi.length > 0 && <span className="titik-notifikasi" />}
          </button>
          {notifTerbuka && (
            <div className="jungkit-panel">
              <div className="jungkit-kepala">Notifikasi</div>
              {notifikasi.length === 0 ? (
                <div className="jungkit-kosong">
                  <Ikon nama="lonceng" ukuran={20} />
                  <span>Belum ada notifikasi</span>
                </div>
              ) : (
                notifikasi.map((n) => (
                  <button
                    key={n.kunci}
                    type="button"
                    className="jungkit-item"
                    onClick={() => setNotifTerbuka(false)}
                  >
                    <Ikon nama={n.ikon} ukuran={16} />
                    <span>
                      {n.teks}
                      <small>{n.waktu}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="jungkit-bungkus">
          <button
            type="button"
            className="kepala-profil"
            onClick={() => {
              setProfilTerbuka((v) => !v)
              setNotifTerbuka(false)
            }}
            aria-expanded={profilTerbuka}
          >
            <span className="avatar-admin">{(namaAdmin[0] || 'A').toUpperCase()}</span>
            <span className="kepala-profil-teks">
              <strong>{namaAdmin}</strong>
              <span>{labelPeran}</span>
            </span>
            <Ikon nama="panahBawah" ukuran={15} />
          </button>
          {profilTerbuka && (
            <div className="jungkit-panel lebar">
              <div className="jungkit-kepala">Akun Admin</div>
              <button
                type="button"
                className="jungkit-item"
                onClick={() => {
                  setProfilTerbuka(false)
                  navigate('/admin/pengaturan')
                }}
              >
                <Ikon nama="pengguna" ukuran={16} />
                Profil Saya
              </button>
              <button
                type="button"
                className="jungkit-item"
                onClick={() => {
                  setProfilTerbuka(false)
                  navigate('/admin/pengaturan')
                }}
              >
                <Ikon nama="pengaturan" ukuran={16} />
                Pengaturan
              </button>
              <button
                type="button"
                className="jungkit-item bahaya"
                onClick={akhiriSesi}
              >
                <Ikon nama="keluar" ukuran={16} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
