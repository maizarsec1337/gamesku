// Halaman /masuk — login/daftar pembeli Gameku.store (di luar TataLetak).
// Mode daftar memakai tambahPelanggan() nyata; mode masuk hanya validasi bentuk
// (endpoint sesi pembeli belum ada di backend).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { tambahPelanggan } from '../layanan/layananPelanggan.js'

const STATUS_SISTEM = [
  { nilai: 'Lokal', label: 'Daftar tersimpan' },
  { nilai: 'Belum', label: 'Sesi server' },
  { nilai: 'Valid', label: 'Validasi bentuk' },
]

export default function HalamanMasuk() {
  const [mode, setMode] = useState('masuk') // 'masuk' | 'daftar'
  const [form, setForm] = useState({ nama: '', email: '', kataSandi: '' })
  const [tampilSandi, setTampilSandi] = useState(false)
  const [pesan, setPesan] = useState('')
  const [jenisPesan, setJenisPesan] = useState('salah') // 'salah' | 'info' | 'ok'
  const [galatBidang, setGalatBidang] = useState({})

  const ubah = (kunci) => (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }))

  // Validasi bentuk input; tambahPelanggan() menyimpan nama + email saja.
  const kirim = (e) => {
    e.preventDefault()
    const galat = {}
    if (!form.email.includes('@') || !form.email.includes('.')) galat.email = 'Masukkan alamat email yang valid.'
    if (mode === 'masuk' && form.kataSandi.length < 4) galat.kataSandi = 'Kata sandi minimal 4 karakter.'
    if (mode === 'daftar' && !form.nama.trim()) galat.nama = 'Isi nama gamer kamu.'
    setGalatBidang(galat)
    if (Object.keys(galat).length > 0) {
      setJenisPesan('salah')
      setPesan('Periksa kembali isian yang ditandai.')
      return
    }
    if (mode === 'daftar') {
      const hasil = tambahPelanggan({ nama: form.nama.trim(), email: form.email.trim(), username: '' })
      if (!hasil.berhasil) {
        setJenisPesan('salah')
        setPesan(hasil.pesan)
        return
      }
      setJenisPesan('ok')
      setPesan(`Pendaftaran tersimpan di browser ini (${hasil.data.email}). Masuk sesi pembeli membutuhkan endpoint backend yang belum tersedia — lihat catatan di bawah.`)
      return
    }
    // Mode masuk: tanpa endpoint sesi pembeli, jadi tidak ada verifikasi.
    setJenisPesan('info')
    setPesan('Masuk sesi pembeli belum tersedia: backend hanya menyediakan POST /api/auth/masuk untuk admin. Data yang kamu isi tidak diverifikasi dan tidak membuat sesi. Gunakan mode Daftar untuk menyimpan data lewat fungsi asli tambahPelanggan().')
  }

  const gantiMode = (baru) => {
    setMode(baru)
    setPesan('')
    setGalatBidang({})
    setTampilSandi(false)
  }

  const judul = mode === 'masuk' ? 'Selamat datang kembali' : 'Buat akun gamermu'
  const subjudul = mode === 'masuk'
    ? 'Halaman masuk pembeli — sesi server belum tersedia, baca catatan sebelum mengisi.'
    : 'Daftar pembeli memakai fungsi asli tambahPelanggan() — tersimpan di browser ini.'

  return (
    <div className="gk-masuk">
      <header className="gk-masuk-atas"><div className="wadah gk-masuk-atas-isi">
        <Link className="logo" to="/" aria-label="Gameku.store">
          <span className="logo-gameku gk-logo" aria-hidden="true">G</span>
          <span className="logo-teks">Gameku.store<small>gaming store</small></span>
        </Link>
        <Link className="gk-kembali" to="/">← Beranda</Link>
      </div></header>

      <main className="wadah gk-masuk-utama">
        <div className="gk-masuk-grid">
          <aside className="gk-masuk-brand" aria-label="Tentang Gameku.store">
            <span className="gk-brand-lencana"><Ikon nama="perisai" ukuran={13} /> Akun Gameku.store</span>
            <h1>{judul}</h1>
            <p>{subjudul}</p>
            <ul className="gk-brand-poin">
              <li><Ikon nama="pengguna" ukuran={16} /> Mode Daftar memakai fungsi asli tambahPelanggan() dari layananPelanggan.</li>
              <li><Ikon nama="sandi" ukuran={16} /> Validasi bentuk email + kata sandi dipertahankan dari kode lama.</li>
              <li><Ikon nama="info" ukuran={16} /> Mode Masuk belum memverifikasi — endpoint sesi pembeli belum ada.</li>
            </ul>
            <div className="gk-brand-stat">
              {STATUS_SISTEM.map((s) => (
                <div key={s.label}><strong>{s.nilai}</strong><span>{s.label}</span></div>
              ))}
            </div>
          </aside>

          <section className="gk-masuk-kartu" aria-label="Formulir akun">
            <div className="gk-tab" role="tablist" aria-label="Pilih mode akun">
              <button type="button" role="tab" aria-selected={mode === 'masuk'} className={mode === 'masuk' ? 'aktif' : ''} onClick={() => gantiMode('masuk')}>Masuk</button>
              <button type="button" role="tab" aria-selected={mode === 'daftar'} className={mode === 'daftar' ? 'aktif' : ''} onClick={() => gantiMode('daftar')}>Daftar</button>
            </div>
            <h2 className="gk-masuk-judul">{mode === 'masuk' ? 'Masuk ke Gameku.store' : 'Daftar akun baru'}</h2>
            <p className="gk-masuk-sub">{mode === 'masuk' ? 'Belum ada sesi server — isi form untuk cek validasi, bukan untuk masuk sungguhan.' : 'Menyimpan lewat tambahPelanggan() ke koleksi lokal browser ini.'}</p>

            <form onSubmit={kirim} noValidate>
              {mode === 'daftar' && (
                <div className="bidang">
                  <label className="label-isian" htmlFor="masuk-nama">Nama gamer</label>
                  <div className={galatBidang.nama ? 'gk-input gk-error' : 'gk-input'}>
                    <Ikon nama="pengguna" ukuran={16} />
                    <input id="masuk-nama" value={form.nama} onChange={ubah('nama')} placeholder="gamer123" autoComplete="nickname" aria-invalid={!!galatBidang.nama} />
                  </div>
                  {galatBidang.nama && <span className="pesan-salah" role="alert">{galatBidang.nama}</span>}
                </div>
              )}
              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-email">Email</label>
                <div className={galatBidang.email ? 'gk-input gk-error' : 'gk-input'}>
                  <Ikon nama="surel" ukuran={16} />
                  <input id="masuk-email" type="email" minLength={6} value={form.email} onChange={ubah('email')} placeholder="kamu@email.com" autoComplete="email" aria-invalid={!!galatBidang.email} />
                </div>
                {galatBidang.email && <span className="pesan-salah" role="alert">{galatBidang.email}</span>}
              </div>
              {mode === 'masuk' && (
              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-sandi">Kata sandi</label>
                <div className={galatBidang.kataSandi ? 'gk-input gk-error' : 'gk-input'}>
                  <Ikon nama="sandi" ukuran={16} />
                  <input id="masuk-sandi" type={tampilSandi ? 'text' : 'password'} value={form.kataSandi} onChange={ubah('kataSandi')} placeholder="••••••••" autoComplete="current-password" aria-invalid={!!galatBidang.kataSandi} />
                  <button type="button" className="gk-lihat" onClick={() => setTampilSandi((v) => !v)} aria-label={tampilSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={tampilSandi}>
                    <Ikon nama={tampilSandi ? 'mataTutup' : 'lihat'} ukuran={17} />
                  </button>
                </div>
                {galatBidang.kataSandi && <span className="pesan-salah" role="alert">{galatBidang.kataSandi}</span>}
              </div>
              )}
              {mode === 'daftar' && (
                <p className="gk-masuk-catatan">Fungsi asli tambahPelanggan() hanya menyimpan nama + email — kolom kata sandi sengaja tidak ditampilkan agar tidak ada input yang diabaikan.</p>
              )}
              {pesan && <p className={jenisPesan === 'ok' ? 'gk-pesan gk-pesan-ok' : jenisPesan === 'info' ? 'gk-pesan gk-pesan-info' : 'gk-pesan'} role="alert"><Ikon nama="info" ukuran={15} /> {pesan}</p>}
              <button type="submit" className="tombol tombol-lebar gk-tombol-masuk">
                {mode === 'masuk' ? 'Cek Validasi' : 'Daftar'}
              </button>
            </form>

            <div className="gk-masuk-bawah">
              {mode === 'masuk'
                ? <button type="button" className="tautan-lihat" onClick={() => gantiMode('daftar')}>Belum punya akun? Daftar</button>
                : <button type="button" className="tautan-lihat" onClick={() => gantiMode('masuk')}>Sudah punya akun? Masuk</button>}
            </div>
            <p className="gk-masuk-catatan">Kebutuhan backend: endpoint sesi pembeli (mis. POST /api/pelanggan/masuk + GET sesi) dan reset kata sandi. Backend saat ini hanya menyediakan POST /api/auth/masuk untuk admin. Tombol Lupa kata sandi tidak ditampilkan karena endpointnya belum ada.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

