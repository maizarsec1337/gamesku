// Halaman /masuk — login/daftar pembeli Gameku.store (di luar TataLetak).
// Auth NYATA via backend buyer (PHP sesi + cookie):
//   POST /api/pelanggan/masuk   login pembeli
//   POST /api/pelanggan         daftar pembeli baru
//   GET  /api/pelanggan/saya    cek sesi (digunakan useSesiPembeli)
// Setelah login sukses, redirect ke tujuan dari location.state.dari
// (default /profil). Tidak ada klaim palsu — backend yang membuktikan.
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { useSesiPembeli } from '../konteks/gunakanSesiPembeli.js'
import '../css/masuk-premium.css'

function emailValid(email) {
  const v = String(email || '').trim()
  if (v.length < 6 || v.length > 150) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

export default function HalamanMasuk() {
  const navigasi = useNavigate()
  const lokasi = useLocation()
  const tujuan = lokasi.state?.dari || '/profil'
  const { status, masuk: masukFungsi, daftar, error } = useSesiPembeli()
  const [mode, setMode] = useState('masuk') // 'masuk' | 'daftar'
  const [form, setForm] = useState({ nama: '', email: '', kataSandi: '' })
  const [tampilSandi, setTampilSandi] = useState(false)
  const [pesan, setPesan] = useState('')
  const [jenisPesan, setJenisPesan] = useState('info') // 'salah' | 'info' | 'ok'
  const [galatBidang, setGalatBidang] = useState({})
  const [mengirim, setMengirim] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const ubah = (kunci) => (e) => {
    setForm((f) => ({ ...f, [kunci]: e.target.value }))
    setGalatBidang((g) => ({ ...g, [kunci]: undefined }))
  }

  const gantiMode = (m) => {
    setMode(m)
    setPesan('')
    setGalatBidang({})
  }

  const kirim = async (e) => {
    e.preventDefault()
    if (mengirim) return
    const galat = {}
    if (!emailValid(form.email)) galat.email = 'Masukkan alamat email yang valid.'
    if (mode === 'masuk' && form.kataSandi.length < 4) galat.kataSandi = 'Kata sandi minimal 4 karakter.'
    if (mode === 'daftar' && !form.nama.trim()) galat.nama = 'Isi nama gamer kamu.'
    if (mode === 'daftar' && form.kataSandi.length < 8) galat.kataSandi = 'Kata sandi minimal 8 karakter.'
    setGalatBidang(galat)
    if (Object.keys(galat).length > 0) {
      setJenisPesan('salah')
      setPesan('Periksa kembali isian yang ditandai.')
      return
    }
    setMengirim(true)
    setPesan('')
    try {
      if (mode === 'daftar') {
        await daftar(form.nama.trim(), form.email.trim(), form.kataSandi)
        setJenisPesan('ok')
        setPesan(`Akun ${form.email} berhasil dibuat. Silakan masuk.`)
        setForm((f) => ({ ...f, kataSandi: '' }))
        return
      }
      await masukFungsi(form.email.trim(), form.kataSandi)
      // Login sukses — kembali ke halaman tujuan (default /profil).
      navigasi(tujuan, { replace: true })
    } catch (e) {
      setJenisPesan('salah')
      setPesan(e.message || 'Login gagal. Coba lagi.')
    } finally {
      setMengirim(false)
    }
  }

  // Saat status berubah menjadi 'masuk' (mis. setelah daftar lalu otomatis
  // masuk, atau sesi sudah valid saat halaman dimuat), arahkan ke tujuan.
  useEffect(() => {
    if (status === 'masuk') {
      navigasi(tujuan, { replace: true })
    }
  }, [status, navigasi, tujuan])

  return (
    <div className="gk-login">
      <main className="gk-login-main">
        <div className="gk-login-kotak">
          <section className="gk-login-atas">
            <Ikon nama="game" ukuran={26} className="gk-login-ikon" />
            <h2 className="gk-login-judul">{mode === 'masuk' ? 'Masuk ke Gameku' : 'Buat akun baru'}</h2>
            <p className="gk-login-subjudul">
              {mode === 'masuk'
                ? 'Masuk untuk mengakses profil, wishlist, dan pesananmu.'
                : 'Isi data di bawah untuk mendaftar di Gameku.store.'}
            </p>
            {error && (
              <p className="gk-login-pesan gk-login-pesan-salah" role="alert">
                <Ikon nama="peringatan" ukuran={15} /> {error}
              </p>
            )}
          </section>

          <form className="gk-login-form" onSubmit={kirim} noValidate>
            {mode === 'daftar' && (
              <div className="bidang">
                <label className="label-isian" htmlFor="daftar-nama">Nama</label>
                <div className={galatBidang.nama ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                  <Ikon nama="pengguna" ukuran={16} />
                  <input id="daftar-nama" type="text" value={form.nama} onChange={ubah('nama')} placeholder="gamer123" autoComplete="name" aria-invalid={!!galatBidang.nama} disabled={mengirim} />
                </div>
                {galatBidang.nama && <span className="pesan-salah" role="alert">{galatBidang.nama}</span>}
              </div>
            )}
            <div className="bidang">
              <label className="label-isian" htmlFor="masuk-email">Email</label>
              <div className={galatBidang.email ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                <Ikon nama="surel" ukuran={16} />
                <input id="masuk-email" type="email" value={form.email} onChange={ubah('email')} placeholder="kamu@email.com" autoComplete="email" aria-invalid={!!galatBidang.email} disabled={mengirim} />
              </div>
              {galatBidang.email && <span className="pesan-salah" role="alert">{galatBidang.email}</span>}
            </div>
            <div className="bidang">
              <label className="label-isian" htmlFor="masuk-sandi">Kata sandi</label>
              <div className={galatBidang.kataSandi ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                <Ikon nama="sandi" ukuran={16} />
                <input id="masuk-sandi" type={tampilSandi ? 'text' : 'password'} value={form.kataSandi} onChange={ubah('kataSandi')} placeholder="••••••••" autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} aria-invalid={!!galatBidang.kataSandi} disabled={mengirim} />
                <button type="button" className="gk-login-lihat" onClick={() => setTampilSandi((v) => !v)} aria-label={tampilSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={tampilSandi} disabled={mengirim}>
                  <Ikon nama={tampilSandi ? 'mataTutup' : 'lihat'} ukuran={17} />
                </button>
              </div>
              {galatBidang.kataSandi && <span className="pesan-salah" role="alert">{galatBidang.kataSandi}</span>}
            </div>

            <div className="gk-login-pesan-slot" aria-live="polite">
              {pesan && <p className={jenisPesan === 'ok' ? 'gk-login-pesan gk-login-pesan-ok' : jenisPesan === 'info' ? 'gk-login-pesan gk-login-pesan-info' : 'gk-login-pesan gk-login-pesan-salah'} role="alert"><Ikon nama="info" ukuran={15} /> {pesan}</p>}
            </div>

            <button type="submit" className="tombol tombol-lebar gk-login-tombol" disabled={mengirim}>
              {mengirim ? (<><span className="gk-login-putar" aria-hidden="true" /> Memproses…</>) : (mode === 'masuk' ? 'Masuk' : 'Daftar')}
            </button>
          </form>

          <div className="gk-login-bawah">
            {mode === 'masuk'
              ? <button type="button" className="tautan-lihat" onClick={() => gantiMode('daftar')} disabled={mengirim}>Belum punya akun? Daftar</button>
              : <button type="button" className="tautan-lihat" onClick={() => gantiMode('masuk')} disabled={mengirim}>Sudah punya akun? Masuk</button>}
          </div>

          <p className="gk-login-catatan">
            Sesi pembeli disimpan di server (cookie PHP), bukan di browser.
            Backend menyediakan POST /api/pelanggan/masuk, GET /api/pelanggan/saya,
            dan POST /api/pelanggan/keluar. Kata sandi dikirim melalui HTTPS dan
            tidak pernah disimpan di localStorage.
          </p>
        </div>
      </main>
    </div>
  )
}