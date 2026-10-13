import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import '../css/admin-utama.css'

// =====================================================================
// HALAMAN MASUK ADMIN (/admin/login) — FORM TAMPILAN SAJA.
//
// Yang SENGAJA tidak ada di halaman ini:
//   - akun bawaan / akun demo
//   - username atau password yang tertanam di kode
//   - bypass login dengan kombinasi tertentu
//
// Form ini tidak memverifikasi apa pun di sisi peramban. Autentikasi
// sesungguhnya akan datang dari PHP + database:
//
//   POST /api/admin/masuk.php  { pengguna, sandi }
//   → password_hash() + password_verify() + session PHP di server
//
// Selama modul itu belum ada, tautan "Buka Dasbor" hanya membuka
// tampilan panel (pratinjau UI), bukan sesi admin yang sah.
// =====================================================================
export default function AdminLogin() {
  const { sesiServer } = useAdmin()
  const [pengguna, setPengguna] = useState('')
  const [sandi, setSandi] = useState('')
  const [lihatSandi, setLihatSandi] = useState(false)
  const [info, setInfo] = useState('')

  // Latar tubuh memakai tema admin selama di halaman ini.
  useEffect(() => {
    document.body.classList.add('mode-admin')
    return () => document.body.classList.remove('mode-admin')
  }, [])

  // Sudah ada sesi dari server → langsung ke dasbor.
  if (sesiServer) return <Navigate to="/admin" replace />

  const kirim = (e) => {
    e.preventDefault()
    setInfo(
      'Autentikasi belum aktif. Modul PHP + database (password hashing dan session) belum tersedia, sehingga form ini belum dapat memverifikasi kredensial.',
    )
  }

  return (
    <div className="halaman-login">
      <main className="login-kartu">
        <div className="login-logo">
          <span className="bilah-logo-kubus">g</span>
          <span className="login-logo-teks">
            <strong>gamesku</strong>
            <span>Admin Panel</span>
          </span>
        </div>

        <h1 className="login-judul">Masuk ke Admin</h1>
        <p className="login-sub">Panel pengelola Minecraft Digital Store.</p>

        {info && (
          <div className="pesan-salah-login" role="status">
            <Ikon nama="info" ukuran={16} />
            {info}
          </div>
        )}

        <form onSubmit={kirim} noValidate>
          <div className="login-kolom">
            <label htmlFor="login-pengguna">Username</label>
            <input
              id="login-pengguna"
              type="text"
              autoComplete="username"
              value={pengguna}
              onChange={(e) => setPengguna(e.target.value)}
              placeholder="Masukkan username"
              autoFocus
            />
          </div>

          <div className="login-kolom">
            <label htmlFor="login-sandi">Password</label>
            <div className="login-sandi">
              <input
                id="login-sandi"
                type={lihatSandi ? 'text' : 'password'}
                autoComplete="current-password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login-mata"
                onClick={() => setLihatSandi((v) => !v)}
                aria-label={lihatSandi ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                <Ikon nama={lihatSandi ? 'mataTutup' : 'lihat'} ukuran={17} />
              </button>
            </div>
          </div>

          <button type="submit" className="tombol-admin tombol-hijau login-masuk">
            <Ikon nama="keluar" ukuran={16} />
            Masuk
          </button>
        </form>

        <div className="keadaan-kosong-aksi" style={{ marginTop: 18 }}>
          <Link className="tombol-admin tombol-garis" to="/admin">
            <Ikon nama="dasbor" ukuran={16} />
            Buka Dasbor
          </Link>
        </div>

        <p className="login-catatan">
          Halaman ini belum terhubung ke server. Tidak ada akun demo maupun
          kredensial yang tersimpan di dalam kode.
          <br />
          Autentikasi final akan ditangani PHP: password hashing, session, dan
          basis data.
        </p>
      </main>
    </div>
  )
}
