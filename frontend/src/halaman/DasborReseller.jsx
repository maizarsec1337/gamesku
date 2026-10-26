import { Link } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { useSesiPembeli } from '../konteks/gunakanSesiPembeli.js'
import { statusReseller, dashboardReseller, pesananReseller } from '../layanan/layananReseller.js'
import { URL_API } from '../layanan/urlApi.js'

async function muatProduk() {
  const r = await fetch(`${URL_API}/produk?batas=50`, { credentials: 'include', headers: { Accept: 'application/json' } })
  const j = await r.json().catch(() => null)
  if (!r.ok || !j || j.ok !== true || !Array.isArray(j.data)) throw new Error((j && j.pesan) || 'Gagal memuat katalog.')
  return j.data
}

export default function DasborReseller() {
  const { status: sesiStatus, sesi: pembeli } = useSesiPembeli()
  const { data: ajuan, memuat: memuatStatus, galat: galatStatus } = useApi(() => statusReseller(), [])
  const status = ajuan ? ajuan.status : null
  const disetujui = status === 'approved'

  const { data: dash } = useApi(() => (disetujui ? dashboardReseller() : Promise.resolve(null)), [disetujui])
  const { data: pesanan, memuat: memuatPesanan, galat: galatPesanan } = useApi(() => (disetujui ? pesananReseller() : Promise.resolve([])), [disetujui])
  const { data: produk, memuat: memuatProduk, galat: galatProduk } = useApi(() => (disetujui ? muatProduk() : Promise.resolve([])), [disetujui])

  if (sesiStatus === 'memuat' || memuatStatus) {
    return (<section className="kepala-bagian"><div className="wadah"><span className="lencana lencana-biru">Reseller</span><h1 className="judul-halaman">Dashboard Reseller</h1><p className="subjudul-halaman">Memuat status reseller…</p></div></section>)
  }
  if (sesiStatus !== 'masuk') {
    return (<section className="kepala-bagian"><div className="wadah"><span className="lencana lencana-biru">Reseller</span><h1 className="judul-halaman">Dashboard Reseller</h1><p className="subjudul-halaman">Anda harus masuk terlebih dahulu.</p><Link className="tombol tombol-garis" to="/masuk" state={{ dari: '/profil/reseller/dashboard' }}>Masuk dulu</Link></div></section>)
  }
  if (galatStatus) {
    return (<section className="kepala-bagian"><div className="wadah"><span className="lencana lencana-biru">Reseller</span><h1 className="judul-halaman">Dashboard Reseller</h1><p className="subjudul-halaman" style={{ color: '#f87171' }}>{pesanGalat(galatStatus)}</p><Link className="tombol tombol-garis" to="/profil/reseller">Kembali</Link></div></section>)
  }
  if (!disetujui) {
    return (<section className="kepala-bagian"><div className="wadah"><span className="lencana lencana-biru">Reseller</span><h1 className="judul-halaman">Dashboard Reseller</h1><p className="subjudul-halaman">Dashboard hanya tersedia setelah pengajuan disetujui. Status saat ini: <strong>{status || 'not_registered'}</strong>.</p><Link className="tombol tombol-garis" to="/profil/reseller">Lihat status pengajuan</Link></div></section>)
  }

  const stat = dash?.statistik || {}
  const daftarPesanan = Array.isArray(pesanan) ? pesanan : []
  const daftarProduk = Array.isArray(produk) ? produk : []

  return (
    <>
      <section className="kepala-bagian"><div className="wadah"><span className="lencana lencana-biru">Reseller</span><h1 className="judul-halaman">Dashboard Reseller</h1><p className="subjudul-halaman">Halo, {pembeli?.nama || pembeli?.username}. Kelola aktivitas reseller Anda di sini.</p></div></section>
      <section className="bagian"><div className="wadah" style={{ display: 'grid', gap: 16 }}>
        <article className="kartu"><div className="kartu-isi" style={{ display: 'grid', gap: 8 }}>
          <strong>Profil Reseller</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 13.6 }}>
            <div><span className="teks-redup">Nama:</span> {dash?.ajuan?.nama || pembeli?.nama}</div>
            <div><span className="teks-redup">Email:</span> {dash?.ajuan?.email || pembeli?.email}</div>
            <div><span className="teks-redup">Username:</span> @{dash?.ajuan?.username || pembeli?.username}</div>
            <div><span className="teks-redup">WhatsApp:</span> {dash?.ajuan?.whatsapp}</div>
            <div><span className="teks-redup">Status:</span> {dash?.ajuan?.status}</div>
          </div>
        </div></article>
        <div className="kisi-produk" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {[
            { label: 'Jumlah Pesanan', nilai: stat.jumlahPesanan ?? 0 },
            { label: 'Total Berhasil', nilai: stat.totalBerhasil ?? 0 },
            { label: 'Total Semua', nilai: stat.totalSemua ?? 0 },
          ].map((s) => (
            <article key={s.label} className="kartu"><div className="kartu-isi" style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: 20, color: '#43DDF5' }}>{s.nilai}</strong>
              <p className="subjudul-halaman" style={{ margin: 0 }}>{s.label}</p>
            </div></article>
          ))}
        </div>
        <p className="subjudul-halaman" style={{ margin: 0, fontSize: 12.8 }}>{dash?.catatan}</p>
        <article className="kartu"><div className="kartu-isi">
          <strong>Riwayat Pesanan</strong>
          {memuatPesanan && <p className="subjudul-halaman">Memuat…</p>}
          {galatPesanan && <p style={{ color: '#f87171', fontSize: 13.6 }}>{pesanGalat(galatPesanan)}</p>}
          {!memuatPesanan && daftarPesanan.length === 0 && <p className="subjudul-halaman">Belum ada pesanan.</p>}
          {daftarPesanan.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', fontSize: 13.6, borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left' }}><th>ID</th><th>Produk</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead>
                <tbody>
                  {daftarPesanan.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                      <td>{p.id}</td><td>{p.produk}</td><td>{p.total}</td><td>{p.status}</td><td>{p.dibuatPada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div></article>
        <article className="kartu"><div className="kartu-isi">
          <strong>Katalog Produk</strong>
          <p className="subjudul-halaman" style={{ margin: '4px 0 8px' }}>Harga referensi (harga jual reseller khusus belum dikonfigurasi).</p>
          {memuatProduk && <p className="subjudul-halaman">Memuat…</p>}
          {galatProduk && <p style={{ color: '#f87171', fontSize: 13.6 }}>{pesanGalat(galatProduk)}</p>}
          {!memuatProduk && daftarProduk.length === 0 && <p className="subjudul-halaman">Belum ada produk.</p>}
          {daftarProduk.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 8 }}>
              {daftarProduk.map((p) => (
                <div key={p.id} className="kartu" style={{ padding: 10 }}>
                  <strong style={{ fontSize: 14 }}>{p.nama}</strong>
                  <p className="subjudul-halaman" style={{ margin: '4px 0' }}>{p.jenis} · {p.status}</p>
                  <div style={{ fontSize: 13.6 }}>Harga: <strong>{p.harga}</strong></div>
                  {p.harga_diskon ? <div style={{ fontSize: 12.8, color: '#43DDF5' }}>Diskon: {p.harga_diskon}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div></article>
        <article className="kartu"><div className="kartu-isi">
          <strong>Panduan & Ketentuan</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.6 }}>
            <li>Dashboard hanya dapat diakses setelah pengajuan disetujui admin.</li>
            <li>Pesanan yang ditampilkan adalah pesanan milik akun Anda.</li>
            <li>Harga reseller, komisi, dan katalog khusus belum dikonfigurasi; hubungi admin.</li>
            <li>Patuhi syarat & ketentuan program reseller Gamesku.</li>
          </ul>
        </div></article>
        <Link className="tombol tombol-garis" to="/profil/reseller"><Ikon nama="panahKiri" ukuran={15} /> Kembali ke pendaftaran reseller</Link>
      </div></section>
    </>
  )
}
