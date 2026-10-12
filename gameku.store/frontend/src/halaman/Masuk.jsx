// Halaman /masuk — form login/daftar (di luar TataLetak, layout sendiri).
// Tanpa akun bawaan: validasi hanya bentuk di sisi peramban, penentuan
// session sepenuhnya milik server PHP + database nanti.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'

export default function HalamanMasuk() {
  const navigasi = useNavigate()
  const [mode, setMode] = useState('masuk') // 'masuk' | 'daftar'
  const [form, setForm] = useState({ nama: '', email: '', kataSandi: '' })
  const [pesan, setPesan] = useState('')

  const ubah = (kunci) => (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }))

  // Validasi bentuk input saja. Tidak ada kredensial yang disimpan di sini.
  const kirim = (e) => {
    e.preventDefault()
    if (!form.email.includes('@') || form.kataSandi.length < 4) {
      setPesan('Email tidak valid atau kata sandi minimal 4 karakter.')
      return
    }
    if (mode === 'daftar' && !form.nama.trim()) {
      setPesan('Isi nama gamer kamu.')
      return
    }
    navigasi('/profil')
  }

  return (
    <div className="halaman-masuk">
      <header className="kepala"><div className="wadah kepala-isi">
        <Link className="logo" to="/" aria-label="RAK VIN">
          <span className="logo-gameku" aria-hidden="true">R</span>
          <span className="logo-teks">RAK VIN<small>gaming store</small></span>
        </Link>
      </div></header>

      <main className="wadah masuk-utama">
        <section className="kartu masuk-kartu">
          <div className="kartu-isi">
            <span className="lencana lencana-biru"><Ikon nama="perisai" ukuran={13} /> Akun RAK VIN</span>
            <h1 className="judul-halaman" style={{ marginTop: 10 }}>{mode === 'masuk' ? 'Masuk' : 'Daftar Akun'}</h1>
            <p className="subjudul-halaman" style={{ marginBottom: 16 }}>
              {mode === 'masuk' ? 'Belum punya akun? Daftar gratis.' : 'Sudah punya akun? Langsung masuk.'}
            </p>

            <form onSubmit={kirim}>
              {mode === 'daftar' && (
                <div className="bidang">
                  <label className="label-isian" htmlFor="masuk-nama">Nama gamer</label>
                  <input id="masuk-nama" className="isian" value={form.nama} onChange={ubah('nama')} placeholder="gamer123" autoComplete="nickname" />
                </div>
              )}
              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-email">Email</label>
                <input id="masuk-email" type="email" className="isian" value={form.email} onChange={ubah('email')} placeholder="kamu@email.com" autoComplete="email" />
              </div>
              <div className="bidang">
                <label className="label-isian" htmlFor="masuk-sandi">Kata sandi</label>
                <input id="masuk-sandi" type="password" className="isian" value={form.kataSandi} onChange={ubah('kataSandi')} placeholder="••••••••" autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} />
              </div>
              {pesan && <span className="pesan-salah" role="alert">{pesan}</span>}
              <button type="submit" className="tombol tombol-utama tombol-lebar" style={{ marginTop: 12 }}>
                {mode === 'masuk' ? 'Masuk' : 'Daftar & Masuk'}
              </button>
            </form>

            <button type="button" className="tautan-lihat" style={{ marginTop: 16 }} onClick={() => { setMode(mode === 'masuk' ? 'daftar' : 'masuk'); setPesan('') }}>
              {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </button>
          </div>
        </section>
        <p className="subjudul-halaman" style={{ textAlign: 'center', marginTop: 16 }}>
          Autentikasi asli menyusul via PHP + database. <Link className="tautan-lihat" to="/">Kembali ke beranda</Link>
        </p>
      </main>
    </div>
  )
}