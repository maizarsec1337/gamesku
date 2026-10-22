// Halaman /masuk — login/daftar pembeli Gameku.store (di luar TataLetak).
// Auth NYATA via backend pembeli (PHP sesi + cookie):
//   POST /api/pelanggan/masuk   login pembeli
//   POST /api/pelanggan         daftar pembeli baru
//   GET  /api/pelanggan/saya    cek sesi (dipakai useSesiPembeli)
// Setelah login sukses, redirect ke tujuan dari location.state.dari
// (default /profil). Tidak ada klaim palsu — backend yang membuktikan.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  const adaTujuan = Boolean(lokasi.state?.dari)
  const { status, masukFungsi, daftar, error } = useSesiPembeli()
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
    } catch (err) {
      setJenisPesan('salah')
      setPesan(err.message || 'Login gagal. Coba lagi.')
    } finally {
      setMengirim(false)
    }
  }

  // Saat status berubah menjadi 'masuk' (sesi valid), arahkan ke tujuan.
  useEffect(() => {
    if (status === 'masuk') {
      navigasi(tujuan, { replace: true })
    }
  }, [status, navigasi, tujuan])

  return (
    <div className="gk-login">
      {/* Latar ambient — dekoratif, disembunyikan dari pembaca layar. */}
      <div className="gk-login-latar" aria-hidden="true">
        <span className="gk-login-blob gk-login-blob-a" />
        <span className="gk-login-blob gk-login-blob-b" />
        <span className="gk-login-blob gk-login-blob-c" />
        <span className="gk-login-kisi" />
        <span className="gk-login-partikel gk-login-p1" />
        <span className="gk-login-partikel gk-login-p2" />
        <span className="gk-login-partikel gk-login-p3" />
        <span className="gk-login-partikel gk-login-p4" />
        <span className="gk-login-partikel gk-login-p5" />
        <span className="gk-login-partikel gk-login-p6" />
      </div>

      {/* Bar atas: logo Gameku (aset yang sudah ada) + tautan kembali. */}
      <header className="gk-login-atas">
        <div className="gk-login-atas-isi">
          <Link className="logo" to="/" aria-label="Gamesku — beranda">
            <span className="logo-gameku" aria-hidden="true">G</span>
            <span className="logo-teks">
              Gamesku
              <small>Halo, Gamer!</small>
            </span>
          </Link>
          <Link className="gk-login-kembali" to="/">
            <Ikon nama="panahKiri" ukuran={14} />
            Kembali ke toko
          </Link>
        </div>
      </header>

      <main className="gk-login-utama">
        <div className="gk-login-grid">
          {/* Panel brand (informasi, bukan form). */}
          <section className="gk-login-brand">
            <span className="gk-login-lencana">Gameku.store</span>
            <h1>Masuk ke akun Gameku</h1>
            <p>
              Satu akun untuk pengalaman belanja yang lebih cepat di marketplace
              konten Minecraft Gameku.
            </p>
            <ul className="gk-login-poin">
              <li>
                <Ikon nama="perisai" ukuran={16} />
                <span>Sesi pembeli aman — diverifikasi server (cookie PHP).</span>
              </li>
              <li>
                <Ikon nama="keranjang" ukuran={16} />
                <span>Checkout lebih cepat dengan akun yang sudah masuk.</span>
              </li>
              <li>
                <Ikon nama="hati" ukuran={16} />
                <span>Simpan wishlist dan keranjang belanjamu.</span>
              </li>
              <li>
                <Ikon nama="pengguna" ukuran={16} />
                <span>Kelola profil pembeli di halaman Profil.</span>
              </li>
            </ul>
            <p className="gk-login-brand-catatan">
              Kata sandi diverifikasi di server memakai <code>password_verify()</code> dan
              tidak pernah disimpan di browser.
            </p>
          </section>

          {/* Kartu form. */}
          <section className="gk-login-kartu">
            <span className="gk-login-kartu-glow" aria-hidden="true" />

            <div className="gk-login-tab" role="tablist" aria-label="Pilih masuk atau daftar">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'masuk'}
                className={mode === 'masuk' ? 'aktif' : ''}
                onClick={() => gantiMode('masuk')}
                disabled={mengirim}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'daftar'}
                className={mode === 'daftar' ? 'aktif' : ''}
                onClick={() => gantiMode('daftar')}
                disabled={mengirim}
              >
                Daftar
              </button>
            </div>

            <h2 className="gk-login-judul">
              {mode === 'masuk' ? 'Masuk ke akunmu' : 'Buat akun baru'}
            </h2>
            <p className="gk-login-sub">
              {mode === 'masuk'
                ? 'Masuk untuk mengakses profil, wishlist, dan keranjangmu.'
                : 'Isi data di bawah untuk mendaftar di Gameku.store.'}
            </p>

            {adaTujuan && (
              <p className="gk-login-tujuan">
                <Ikon nama="info" ukuran={15} />
                Masuk untuk melanjutkan ke halaman yang kamu tuju.
              </p>
            )}

            {error && (
              <p className="gk-login-pesan gk-login-pesan-salah" role="alert">
                <Ikon nama="info" ukuran={15} /> {error}
              </p>
            )}

            <form onSubmit={kirim} noValidate>
              {mode === 'daftar' && (
                <div className="bidang">
                  <label className="label-isian" htmlFor="daftar-nama">Nama</label>
                  <div className={galatBidang.nama ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                    <Ikon nama="pengguna" ukuran={16} />
                    <input
                      id="daftar-nama"
                      type="text"
                      value={form.nama}
                      onChange={ubah('nama')}
                      placeholder="Nama gamer"
                      autoComplete="name"
                      aria-invalid={!!galatBidang.nama}
                      disabled={mengirim}
                    />
                  </div>
                  {galatBidang.nama && <span className="pesan-salah" role="alert">{galatBidang.nama}</span>}
                </div>
              )}

              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-email">Email</label>
                <div className={galatBidang.email ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                  <Ikon nama="surel" ukuran={16} />
                  <input
                    id="masuk-email"
                    type="email"
                    value={form.email}
                    onChange={ubah('email')}
                    placeholder="kamu@email.com"
                    autoComplete="email"
                    aria-invalid={!!galatBidang.email}
                    disabled={mengirim}
                  />
                </div>
                {galatBidang.email && <span className="pesan-salah" role="alert">{galatBidang.email}</span>}
              </div>

              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-sandi">Kata sandi</label>
                <div className={galatBidang.kataSandi ? 'gk-login-input gk-login-error' : 'gk-login-input'}>
                  <Ikon nama="sandi" ukuran={16} />
                  <input
                    id="masuk-sandi"
                    type={tampilSandi ? 'text' : 'password'}
                    value={form.kataSandi}
                    onChange={ubah('kataSandi')}
                    placeholder="••••••••"
                    autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
                    aria-invalid={!!galatBidang.kataSandi}
                    disabled={mengirim}
                  />
                  <button
                    type="button"
                    className="gk-login-lihat"
                    onClick={() => setTampilSandi((v) => !v)}
                    aria-label={tampilSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={tampilSandi}
                    disabled={mengirim}
                  >
                    <Ikon nama={tampilSandi ? 'mataTutup' : 'lihat'} ukuran={17} />
                  </button>
                </div>
                {galatBidang.kataSandi && <span className="pesan-salah" role="alert">{galatBidang.kataSandi}</span>}
              </div>

              <div className="gk-login-pesan-slot" aria-live="polite">
                {pesan && (
                  <p
                    className={
                      jenisPesan === 'ok'
                        ? 'gk-login-pesan gk-login-pesan-ok'
                        : jenisPesan === 'info'
                          ? 'gk-login-pesan gk-login-pesan-info'
                          : 'gk-login-pesan gk-login-pesan-salah'
                    }
                    role="alert"
                  >
                    <Ikon nama="info" ukuran={15} /> {pesan}
                  </p>
                )}
              </div>

              <button type="submit" className="tombol tombol-lebar gk-login-tombol" disabled={mengirim}>
                {mengirim ? (
                  <>
                    <span className="gk-login-putar" aria-hidden="true" /> Memproses…
                  </>
                ) : mode === 'masuk' ? (
                  'Masuk'
                ) : (
                  'Daftar'
                )}
              </button>
            </form>

            <div className="gk-login-bawah">
              {mode === 'masuk' ? (
                <button type="button" className="tautan-lihat" onClick={() => gantiMode('daftar')} disabled={mengirim}>
                  Belum punya akun? Daftar
                </button>
              ) : (
                <button type="button" className="tautan-lihat" onClick={() => gantiMode('masuk')} disabled={mengirim}>
                  Sudah punya akun? Masuk
                </button>
              )}
            </div>

            <p className="gk-login-catatan">
              Sesi pembeli disimpan di server (cookie PHP), bukan di browser. Kata sandi
              dikirim lewat HTTPS dan tidak disimpan di localStorage.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
