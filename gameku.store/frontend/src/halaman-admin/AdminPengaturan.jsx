import { useState } from 'react'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import '../css/admin-form.css'
import '../css/admin-tabel.css'

const seksiPengaturan = [
  { id: 'profil', nama: 'Profil Admin', ikon: 'pengguna' },
  { id: 'toko', nama: 'Toko', ikon: 'toko' },
  { id: 'pembayaran', nama: 'Pembayaran', ikon: 'kartu' },
  { id: 'notifikasi', nama: 'Notifikasi', ikon: 'lonceng' },
  { id: 'keamanan', nama: 'Keamanan', ikon: 'perisai' },
  { id: 'tampilan', nama: 'Tampilan', ikon: 'palet' },
]

const judulSeksi = {
  profil: ['Profil Admin', 'Informasi akun yang tampil di panel ini'],
  toko: ['Profil Toko', 'Identitas publik Gamesku'],
  pembayaran: ['Pembayaran', 'Aktifkan metode pembayaran yang didukung'],
  notifikasi: ['Notifikasi', 'Atur pemberitahuan masuk untuk admin'],
  keamanan: ['Keamanan', 'Kata sandi & perlindungan akun'],
  tampilan: ['Tampilan', 'Sesuaikan tampilan panel admin'],
}

const pilihanWarna = ['#43DDF5', '#BD54F5', '#43DDF5', '#F044D8', '#F0447A', '#A7B2D0']

// Saklar toggle (role switch agar aksesibel).
function Saklar({ aktif, ubah, label }) {
  return (
    <button
      type="button"
      className={`saklar ${aktif ? 'aktif' : ''}`}
      onClick={ubah}
      role="switch"
      aria-checked={aktif}
      aria-label={label}
    />
  )
}

// Halaman pengaturan (/admin/pengaturan) — UI saja.
export default function AdminPengaturan() {
  const { tampilkanPesan } = useAdmin()
  const [tab, setTab] = useState('profil')
  const [memuat, setMemuat] = useState(false)
  // Profil admin BERASAL DARI SERVER (session PHP). Selama belum ada
  // server, form dibiarkan kosong — tidak ada nama/email contoh.
  const [profil, setProfil] = useState({ nama: '', pengguna: '', email: '', bio: '' })
  const [toko, setToko] = useState({
    nama: 'Gamesku',
    tagline: 'Minecraft Digital Store',
    url: 'https://gamesku.store',
    email: 'halo@gamesku.store',
    telepon: '',
    deskripsi:
      'Marketplace konten Minecraft: skin, map, texture pack, add-on, build, mod, dan bundle.',
  })
  const [saklar, setSaklar] = useState({
    qris: true,
    bank: true,
    ewallet: true,
    paypal: false,
    notifPesanan: true,
    notifUlasan: true,
    notifProduk: true,
    notifPelanggan: false,
    notifNewsletter: true,
    duaFaktor: false,
    animasi: true,
    padat: false,
  })
  const [warna, setWarna] = useState('#43DDF5')

  const ubahSaklar = (kunci) => setSaklar((s) => ({ ...s, [kunci]: !s[kunci] }))
  const simpan = () => {
    if (memuat) return
    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      tampilkanPesan('Pengaturan tersimpan.')
    }, 650)
  }

  const [judulAktif, subAktif] = judulSeksi[tab]

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Pengaturan</h2>
          <p>Konfigurasi panel &amp; toko Gamesku</p>
        </div>
      </div>

      <div className="kisi-pengaturan">
        <nav className="kartu-panel tab-pengaturan" aria-label="Seksi pengaturan">
          {seksiPengaturan.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tab-item ${tab === s.id ? 'aktif' : ''}`}
              onClick={() => setTab(s.id)}
            >
              <Ikon nama={s.ikon} ukuran={17} />
              {s.nama}
            </button>
          ))}
        </nav>

        <section className="kartu-panel">
          <div className="panel-kepala">
            <div>
              <h3 className="panel-judul">{judulAktif}</h3>
              <p className="panel-sub">{subAktif}</p>
            </div>
          </div>
          <div className="panel-badan">
            {tab === 'profil' && (
              <>
                <div className="baris-avatar">
                  <span className="avatar-besar">B</span>
                  <div>
                    <button
                      type="button"
                      className="tombol-admin tombol-garis tombol-kecil"
                      onClick={() =>
                        tampilkanPesan('Unggah foto aktif setelah backend tersedia.')
                      }
                    >
                      <Ikon nama="unggah" ukuran={14} />
                      Ganti Foto
                    </button>
                    <p className="bantuan-form">PNG atau JPG, maksimal 1 MB.</p>
                  </div>
                </div>
                <div className="baris-form">
                  <div className="blok-form">
                    <label className="label-form" htmlFor="set-nama">Nama lengkap</label>
                    <input
                      id="set-nama"
                      className="isian-admin"
                      value={profil.nama}
                      onChange={(e) => setProfil((p) => ({ ...p, nama: e.target.value }))}
                    />
                  </div>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="set-pengguna">Username</label>
                    <input
                      id="set-pengguna"
                      className="isian-admin"
                      value={profil.pengguna}
                      onChange={(e) => setProfil((p) => ({ ...p, pengguna: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="set-email">Email</label>
                  <input
                    id="set-email"
                    type="email"
                    className="isian-admin"
                    value={profil.email}
                    onChange={(e) => setProfil((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="set-bio">Bio singkat</label>
                  <textarea
                    id="set-bio"
                    className="area-teks-admin"
                    style={{ minHeight: 90 }}
                    value={profil.bio}
                    onChange={(e) => setProfil((p) => ({ ...p, bio: e.target.value }))}
                  />
                </div>
              </>
            )}

            {tab === 'toko' && (
              <>
                <div className="baris-form">
                  <div className="blok-form">
                    <label className="label-form" htmlFor="toko-nama">Nama toko</label>
                    <input
                      id="toko-nama"
                      className="isian-admin"
                      value={toko.nama}
                      onChange={(e) => setToko((t) => ({ ...t, nama: e.target.value }))}
                    />
                  </div>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="toko-tagline">Tagline</label>
                    <input
                      id="toko-tagline"
                      className="isian-admin"
                      value={toko.tagline}
                      onChange={(e) => setToko((t) => ({ ...t, tagline: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="baris-form">
                  <div className="blok-form">
                    <label className="label-form" htmlFor="toko-url">URL toko</label>
                    <input
                      id="toko-url"
                      className="isian-admin"
                      value={toko.url}
                      onChange={(e) => setToko((t) => ({ ...t, url: e.target.value }))}
                    />
                  </div>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="toko-email">Email kontak</label>
                    <input
                      id="toko-email"
                      type="email"
                      className="isian-admin"
                      value={toko.email}
                      onChange={(e) => setToko((t) => ({ ...t, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="toko-tel">Telepon / WhatsApp</label>
                  <input
                    id="toko-tel"
                    className="isian-admin"
                    value={toko.telepon}
                    onChange={(e) => setToko((t) => ({ ...t, telepon: e.target.value }))}
                  />
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="toko-desk">Deskripsi toko</label>
                  <textarea
                    id="toko-desk"
                    className="area-teks-admin"
                    value={toko.deskripsi}
                    onChange={(e) => setToko((t) => ({ ...t, deskripsi: e.target.value }))}
                  />
                </div>
              </>
            )}

            {tab === 'pembayaran' && (
              <>
                {[
                  { kunci: 'qris', nama: 'QRIS', ket: 'Semua e-wallet & mobile banking', ikon: 'label' },
                  { kunci: 'bank', nama: 'Transfer Bank', ket: 'BCA · Mandiri · BNI · BRI', ikon: 'kartu' },
                  { kunci: 'ewallet', nama: 'E-Wallet', ket: 'GoPay · OVO · DANA · ShopeePay', ikon: 'dompet' },
                  { kunci: 'paypal', nama: 'PayPal', ket: 'Pembayaran internasional', ikon: 'globe' },
                ].map((m) => (
                  <div key={m.kunci} className="kartu-metode">
                    <span className="kartu-metode-kiri">
                      <span className="kartu-metode-ikon">
                        <Ikon nama={m.ikon} ukuran={18} />
                      </span>
                      <span className="kartu-metode-teks">
                        <strong>{m.nama}</strong>
                        <span>{m.ket}</span>
                      </span>
                    </span>
                    <Saklar
                      aktif={saklar[m.kunci]}
                      ubah={() => ubahSaklar(m.kunci)}
                      label={`Aktifkan ${m.nama}`}
                    />
                  </div>
                ))}
                <div className="baris-form" style={{ marginTop: 18 }}>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="bayar-bank">
                      Nama bank penerima
                    </label>
                    <input id="bayar-bank" className="isian-admin" defaultValue="BCA" />
                  </div>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="bayar-akun">
                      Nomor rekening
                    </label>
                    <input id="bayar-akun" className="isian-admin" placeholder="Nomor rekening toko" />
                  </div>
                </div>
              </>
            )}

            {tab === 'notifikasi' && (
              <>
                {[
                  { kunci: 'notifPesanan', nama: 'Pesanan baru masuk', ket: 'Beri tahu saat ada transaksi baru' },
                  { kunci: 'notifUlasan', nama: 'Ulasan baru', ket: 'Notifikasi moderasi ulasan pelanggan' },
                  { kunci: 'notifProduk', nama: 'Produk menunggu review', ket: 'Kirim saat creator mengajukan produk' },
                  { kunci: 'notifPelanggan', nama: 'Pelanggan baru mendaftar', ket: 'Ringkasan akun baru per hari' },
                  { kunci: 'notifNewsletter', nama: 'Newsletter mingguan', ket: 'Rekap penjualan mingguan ke email admin' },
                ].map((n) => (
                  <div key={n.kunci} className="baris-saklar">
                    <span className="baris-saklar-teks">
                      <strong>{n.nama}</strong>
                      <span>{n.ket}</span>
                    </span>
                    <Saklar
                      aktif={saklar[n.kunci]}
                      ubah={() => ubahSaklar(n.kunci)}
                      label={n.nama}
                    />
                  </div>
                ))}
              </>
            )}

            {tab === 'keamanan' && (
              <>
                <div className="baris-form">
                  <div className="blok-form">
                    <label className="label-form" htmlFor="kam-saat">Kata sandi saat ini</label>
                    <input id="kam-saat" type="password" className="isian-admin" placeholder="••••••••" autoComplete="current-password" />
                  </div>
                  <div className="blok-form">
                    <label className="label-form" htmlFor="kam-baru">Kata sandi baru</label>
                    <input id="kam-baru" type="password" className="isian-admin" placeholder="••••••••" autoComplete="new-password" />
                  </div>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="kam-ulang">Ulangi kata sandi baru</label>
                  <input id="kam-ulang" type="password" className="isian-admin" placeholder="••••••••" autoComplete="new-password" />
                  <p className="bantuan-form">
                    Produksi: kata sandi diverifikasi server dengan password_hash() PHP.
                  </p>
                </div>
                <div className="baris-saklar">
                  <span className="baris-saklar-teks">
                    <strong>Autentikasi dua faktor (2FA)</strong>
                    <span>Kode tambahan via aplikasi authenticator saat masuk.</span>
                  </span>
                  <Saklar
                    aktif={saklar.duaFaktor}
                    ubah={() => ubahSaklar('duaFaktor')}
                    label="Aktifkan dua faktor"
                  />
                </div>
                <div className="kartu-metode" style={{ marginTop: 16 }}>
                  <span className="kartu-metode-kiri">
                    <span className="kartu-metode-ikon">
                      <Ikon nama="perisai" ukuran={18} />
                    </span>
                    <span className="kartu-metode-teks">
                      <strong>Belum ada sesi server</strong>
                      <span>Riwayat perangkat muncul setelah session PHP aktif.</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="tombol-admin tombol-bahaya tombol-kecil"
                    onClick={() => tampilkanPesan('Keluar semua perangkat (menunggu server).')}
                  >
                    Keluar semua
                  </button>
                </div>
              </>
            )}

            {tab === 'tampilan' && (
              <>
                <div className="blok-form">
                  <span className="label-form">Warna aksen panel</span>
                  <div className="kisi-swatch">
                    {pilihanWarna.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`swatch-warna ${warna === w ? 'aktif' : ''}`}
                        style={{ background: w }}
                        onClick={() => setWarna(w)}
                        aria-label={`Pilih warna ${w}`}
                      />
                    ))}
                  </div>
                  <p className="bantuan-form">
                    Warna terpilih: <b style={{ color: warna }}>{warna}</b> — diterapkan
                    saat mode tampilan tersimpan.
                  </p>
                </div>
                <div className="baris-saklar">
                  <span className="baris-saklar-teks">
                    <strong>Animasi antarmuka</strong>
                    <span>Transisi halus pada kartu, modal, dan navigasi.</span>
                  </span>
                  <Saklar
                    aktif={saklar.animasi}
                    ubah={() => ubahSaklar('animasi')}
                    label="Animasi antarmuka"
                  />
                </div>
                <div className="baris-saklar">
                  <span className="baris-saklar-teks">
                    <strong>Mode padat</strong>
                    <span>Baris tabel lebih rapat untuk layar kecil.</span>
                  </span>
                  <Saklar
                    aktif={saklar.padat}
                    ubah={() => ubahSaklar('padat')}
                    label="Mode padat"
                  />
                </div>
              </>
            )}
          </div>

          <div
            className="baris-ringkas-admin"
            style={{ borderTop: '1px solid var(--adm-border)' }}
          >
            <span className="teks-redup teks-kecil">
              Perubahan disimpan di browser (belum ada backend).
            </span>
            <button
              type="button"
              className="tombol-admin tombol-hijau"
              onClick={simpan}
              disabled={memuat}
            >
              {memuat ? (
                <>
                  <span className="spinner-bulat" aria-hidden="true" />
                  Menyimpan…
                </>
              ) : (
                <>
                  <Ikon nama="simpan" ukuran={15} />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
