import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import '../css/admin-utama.css'

// Halaman masuk admin (/admin/login). Autentikasi diverifikasi backend Express
// (hash bcrypt kompatibel legacy + sesi server). Tidak ada kredensial yang disimpan di browser.
export default function AdminLogin() {
  const { sesiServer, memuatSesi, masuk } = useAdmin()
  const navigate = useNavigate()
  const [pengguna, setPengguna] = useState('')
  const [sandi, setSandi] = useState('')
  const [lihatSandi, setLihatSandi] = useState(false)
  const [galat, setGalat] = useState('')
  const [mengirim, setMengirim] = useState(false)

  // Latar tubuh memakai tema admin selama di halaman ini.
  useEffect(() => {
    document.body.classList.add('mode-admin')
    return () => document.body.classList.remove('mode-admin')
  }, [])

  // Sudah ada sesi dari server → langsung ke dasbor.
  if (sesiServer) return <Navigate to="/admin" replace />

  const kirim = async (e) => {
    e.preventDefault()
    if (mengirim) return
    setGalat('')
    if (!pengguna.trim() || !sandi) {
      setGalat('Email/username dan kata sandi wajib diisi.')
      return
    }
    setMengirim(true)
    try {
      await masuk(pengguna, sandi)
      navigate('/admin', { replace: true })
    } catch (err) {
      setGalat(
        err?.status === 429
          ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
          : err?.message || 'Gagal masuk. Periksa email/username dan kata sandi.',
      )
    } finally {
      setMengirim(false)
    }
  }

  return (
    <div className="halaman-login">
      <main className="login-kartu">
        <div className="login-logo">
          <span className="bilah-logo-kubus">g</span>
          <span className="login-logo-teks">
            <strong>Gamesku</strong>
            <span>Panel Admin</span>
          </span>
        </div>

        <h1 className="login-judul">Masuk ke Admin</h1>
        <p className="login-sub">Panel pengelola Minecraft Digital Store.</p>

        {galat && (
          <div className="pesan-salah-login" role="alert">
            <Ikon nama="info" ukuran={16} />
            {galat}
          </div>
        )}

        <form onSubmit={kirim} noValidate>
          <div className="login-kolom">
            <label htmlFor="login-pengguna">Email atau Username</label>
            <input
              id="login-pengguna"
              type="text"
              autoComplete="username"
              value={pengguna}
              onChange={(e) => setPengguna(e.target.value)}
              placeholder="email atau username admin"
              autoFocus
              disabled={mengirim || memuatSesi}
              required
            />
          </div>

          <div className="login-kolom">
            <label htmlFor="login-sandi">Kata Sandi</label>
            <div className="login-sandi">
              <input
                id="login-sandi"
                type={lihatSandi ? 'text' : 'password'}
                autoComplete="current-password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                placeholder="••••••••"
                disabled={mengirim || memuatSesi}
                required
              />
              <button
                type="button"
                className="login-mata"
                onClick={() => setLihatSandi((v) => !v)}
                aria-label={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <Ikon nama={lihatSandi ? 'mataTutup' : 'lihat'} ukuran={17} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="tombol-admin tombol-hijau login-masuk"
            disabled={mengirim || memuatSesi}
          >
            {mengirim ? (
              <span className="cb-putar" aria-hidden="true" />
            ) : (
              <Ikon nama="keluar" ukuran={16} />
            )}
            {mengirim ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>

        <p className="login-catatan">
          Autentikasi diverifikasi oleh server menggunakan hash kompatibel legacy + sesi.
          Tidak ada kredensial yang tersimpan di browser.
        </p>
      </main>
    </div>
  )
}
