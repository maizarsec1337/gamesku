// Halaman /profil — tampilan akun. Data akun & login disambung ke
// PHP + database nanti. Tanpa session, halaman menampilkan empty state
// (tidak ada pengguna contoh, tidak ada email karangan).
import { Link } from 'react-router-dom'
import { useWishlist } from '../konteks/konteksWishlist.js'
import { useKeranjang } from '../konteks/konteksKeranjang.js'
import Ikon from '../komponen/Ikon.jsx'

const menuProfil = [
  { ke: '/keranjang', label: 'Keranjang', ikon: 'keranjang' },
  { ke: '/wishlist', label: 'Wishlist', ikon: 'hati' },
  { ke: '/store', label: 'Belanja Lagi', ikon: 'toko' },
  { ke: '/bantuan', label: 'Bantuan', ikon: 'perisai' },
]

export default function HalamanProfil() {
  const { jumlahSuka } = useWishlist()
  const { jumlahItem } = useKeranjang()

  return (
    <>
      <section className="kepala-bagian"><div className="wadah">
        <span className="lencana lencana-biru">Akun</span>
        <h1 className="judul-halaman">Profil Saya</h1>
        <p className="subjudul-halaman">Kelola akun Gamesku, wishlist, dan pesananmu di sini.</p>
      </div></section>

      <section className="bagian"><div className="wadah" style={{ display: 'grid', gap: 14 }}>
        <article className="kartu"><div className="kartu-isi" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="avatar-creator" style={{ width: 56, height: 56 }} aria-hidden="true"><Ikon nama="pengguna" ukuran={24} /></span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <strong style={{ fontSize: 17 }}>Belum masuk</strong>
            <p className="subjudul-halaman" style={{ margin: 0 }}>Tidak ada akun aktif di browser ini.</p>
          </div>
          <Link className="tombol tombol-garis tombol-kecil" to="/masuk">Masuk</Link>
        </div></article>

        <div className="kisi-produk" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {[
            { label: 'Wishlist', nilai: jumlahSuka },
            { label: 'Keranjang', nilai: jumlahItem },
          ].map((s) => (
            <article key={s.label} className="kartu"><div className="kartu-isi" style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: 22, color: '#1D4ED8' }}>{s.nilai}</strong>
              <p className="subjudul-halaman" style={{ margin: 0 }}>{s.label}</p>
            </div></article>
          ))}
        </div>

        <div className="kisi-produk" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {menuProfil.map((m) => (
            <Link key={m.ke} className="kartu" to={m.ke}><div className="kartu-isi" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Ikon nama={m.ikon} ukuran={18} />
              <strong style={{ fontSize: 14 }}>{m.label}</strong>
            </div></Link>
          ))}
        </div>

        <p className="subjudul-halaman">Pesanan Gamesku akan muncul di sini setelah kamu checkout.</p>
      </div></section>
    </>
  )
}
