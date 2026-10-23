import { useState } from 'react'
import { Link } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { useSesiPembeli } from '../konteks/gunakanSesiPembeli.js'
import { statusReseller, kirimReseller, batalReseller } from '../layanan/layananReseller.js'

// Halaman reseller pembeli (/profil/reseller). Tunggal: menampilkan formulir,
// status pengajuan, atau empty state, semuanya menurut keputusan backend —
// tidak ada data demo / localStorage / flag palsu.
export default function ResellerAjuan() {
  const { status: sesi, sesi: pembeli } = useSesiPembeli()
  const { data: ajuan, memuat, galat, muat } = useApi(() => statusReseller(), [])

  const [form, setForm] = useState({ whatsapp: '', catatan: '' })
  const [cek, setCek] = useState(false) // syarat dicentang
  const [mengirim, setMengirim] = useState(false) // kunci tombol selama request
  const [galatAksi, setGalatAksi] = useState(null)
  const [ajukanUlang, setAjukanUlang] = useState(false)

  const kirim = async (e) => {
    e.preventDefault()
    if (mengirim || !cek || !form.whatsapp) return
    setMengirim(true)
    setGalatAksi(null)
    try {
      await kirimReseller(form.whatsapp, form.catatan)
      await muat()
    } catch (err) { setGalatAksi(err) }
    finally {
      setMengirim(false)
    }
  }

  const batalkan = async () => {
    if (!ajuan || mengirim) return
    setMengirim(true)
    setGalatAksi(null)
    try {
      await batalReseller(ajuan.id)
      await muat()
    } catch (err) { setGalatAksi(err) }
    finally { setMengirim(false) }
  }

  const status = ajuan ? ajuan.status : null

  // 1) Sesi / data sedang diperiksa.
  if (sesi === 'memuat' || memuat) {
    return (
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Reseller</span>
        <h1 className="judul-halaman">Program Reseller</h1>
        <p className="subjudul-halaman">Memuat status pengajuan…</p>
      </div></section>
    )
  }

  // 2) Belum login → arahkan ke login dengan redirect aman.
  if (sesi !== 'masuk') {
    return (
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Reseller</span>
        <h1 className="judul-halaman">Program Reseller</h1>
        <p className="subjudul-halaman">Anda harus masuk untuk mengikuti program reseller.</p>
        <Link className="tombol tombol-garis" to="/masuk" state={{ dari: '/profil/reseller' }}>
          <Ikon nama="pengguna" ukuran={15} /> Masuk dulu
        </Link>
      </div></section>
    )
  }

  // 3) Error API.
  if (galat) {
    return (
      <>
        <section className="kepala-bagian"><div className="wadah">
          <span className="lencana lencana-biru">Reseller</span>
          <h1 className="judul-halaman">Program Reseller</h1>
          <p className="subjudul-halaman">Tidak dapat memuat status.</p>
        </div></section>
        <section className="bagian"><div className="wadah">
          <div className="kartu"><div className="kartu-isi" role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Ikon nama="info" ukuran={16} />
            <span style={{ color: '#f87171', fontSize: 13.6 }}>{pesanGalat(galat)}</span>
            <button type="button" className="tombol tombol-garis" style={{ marginLeft: 'auto' }} onClick={muat}>
              Coba lagi
            </button>
          </div></div>
        </div></section>
      </>
    )
  }

  // 4) Menampilkan keadaan sesuai keputusan backend.
  if (status === 'pending') {
    return (
      <section className="bagian"><div className="wadah">
        <div className="kartu"><div className="kartu-isi" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ikon nama="jam" ukuran={20} />
          <div>
            <strong>Pengajuan Anda sedang ditinjau.</strong>
            <p className="subjudul-halaman" style={{ margin: 0 }}>
              Tim GameKU akan memverifikasi pendaftaran reseller Anda. Anda akan menerima
              notifikasi melalui email ketika keputusan diambil.
            </p>
          </div>
          <button type="button" className="tombol tombol-garis" style={{ marginLeft: 'auto' }} disabled={mengirim} onClick={batalkan}>
            <Ikon nama="hapus" ukuran={14} /> Batalkan
          </button>
          {galatAksi && <p role="alert">{pesanGalat(galatAksi)}</p>}
        </div></div>
      </div></section>
    )
  }

  if (status === 'approved') {
    return (
      <section className="bagian"><div className="wadah">
        <div className="kartu"><div className="kartu-isi" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ikon nama="cek" ukuran={22} />
          <div>
            <strong>Selamat! Anda telah menjadi Reseller GameKU.</strong>
            <p className="subjudul-halaman" style={{ margin: 0 }}>
              Akses reseller Anda sudah aktif. Buka dashboard untuk melihat katalog, pesanan, dan ringkasan.
            </p>
            <Link className="tombol" to="/profil/reseller/dashboard" style={{ marginTop: 12, display: 'inline-flex' }}>
              <Ikon nama="toko" ukuran={15} /> Buka Dashboard Reseller
            </Link>
          </div>
        </div></div>
      </div></section>
    )
  }

  if (status === 'rejected' && !ajukanUlang) {
    return (
      <section className="bagian"><div className="wadah">
        <div className="kartu"><div className="kartu-isi">
          <strong style={{ color: '#f43f5e' }}>Pengajuan ditolak</strong>
          {ajuan.alasan_penolakan ? <p className="subjudul-halaman">{ajuan.alasan_penolakan}</p> : null}
          <button type="button" className="tombol tombol-garis" style={{ marginTop: 12 }}
            onClick={() => { setCek(false); setForm({ whatsapp: '', catatan: '' }); setAjukanUlang(true); }}>
            <Ikon nama="tambah" ukuran={14} /> Ajukan kembali
          </button>
        </div></div>
      </div></section>
    )
  }

  // 5) Formulir pendaftaran (belum ajukan / setelah ditolak).
  const labelfx = { fontSize: 12.6, fontWeight: 600, color: '#7F8CAD', marginBottom: 7, letterSpacing: '.02em' }
  const inputfx = { width: '100%', padding: '10px 13px', background: 'rgba(0,0,0,.2)',
    border: '1px solid var(--gm-border,#33415A)', borderRadius: 10, color: '#E2E8F0',
    fontSize: 13.6, font: 'inherit' }
  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Reseller</span>
        <h1 className="judul-halaman">Daftar Reseller GameKU</h1>
        <p className="subjudul-halaman">
          Isi data di bawah untuk mengajukan diri. Nama, email, dan username diisi otomatis
          dari akun Anda dan tidak bisa diubah di form ini.
        </p>
      </div></section>

      <section className="bagian"><div className="wadah">
        <div className="kartu"><div className="kartu-isi">
          <form id="form-reseller" onSubmit={kirim}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelfx} htmlFor="reseller-nama">Nama</label>
                <input id="reseller-nama" style={inputfx} type="text"
                  value={pembeli?.nama || ''} readOnly disabled />
              </div>
              <div>
                <label style={labelfx} htmlFor="reseller-email">Email</label>
                <input id="reseller-email" style={inputfx} type="email"
                  value={pembeli?.email || ''} readOnly disabled />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelfx} htmlFor="reseller-username">Username</label>
                <input id="reseller-username" style={inputfx} type="text"
                  value={pembeli?.username || ''} readOnly disabled />
              </div>
              <div>
                <label style={labelfx} htmlFor="reseller-whatsapp">
                  WhatsApp <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input id="reseller-whatsapp" style={inputfx} type="tel"
                  placeholder="contoh: 6281234567890"
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value.replace(/[^0-9]/g, '') }))}
                  autoComplete="tel"
                  required />
              </div>
            </div>

            <div>
              <label style={labelfx} htmlFor="reseller-catatan">Catatan (opsional)</label>
              <textarea id="reseller-catatan" style={{ ...inputfx, minHeight: 120, resize: 'vertical' }}
                placeholder="Hal yang ingin kami ketahui (mis. pengalaman promosi, jangkauan wilayah)."
                value={form.catatan}
                onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                maxLength={500} />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <input type="checkbox" id="syarat-reseller" required checked={cek}
                onChange={(e) => setCek(e.target.checked)} />
              <label style={{ ...labelfx, margin: 0 }} htmlFor="syarat-reseller">
                Saya menyatakan informasi di atas benar dan setuju data diproses sesuai{' '}
                <Link to="/syarat" style={{ color: '#43DDF5' }}>Syarat</Link> &amp;{' '}
                <Link to="/privasi" style={{ color: '#43DDF5' }}>Kebijakan Privasi</Link> GameKU.
              </label>
            </div>
            {galatAksi && <p role="alert" style={{ fontSize: 13.6, color: '#f87171' }}>{pesanGalat(galatAksi)}</p>}

            <div className="panel-aksi" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Link to="/profil" className="tombol tombol-garis">
                <Ikon nama="panahKiri" ukuran={15} /> Kembali ke Profil
              </Link>
              <button type="submit" className="tombol"
                style={{ background: (!cek || !form.whatsapp || mengirim) ? 'rgba(34,197,94,.4)' : '#22c55e', color: '#052e16' }}
                disabled={mengirim || !cek || !form.whatsapp}>
                {mengirim
                  ? <><Ikon nama="jam" ukuran={15} /> Mengirim…</>
                  : <><Ikon nama="kirim" ukuran={15} /> Kirim Pengajuan</>}
              </button>
            </div>
          </form>
        </div></div>
      </div></section>
    </>
  )
}
