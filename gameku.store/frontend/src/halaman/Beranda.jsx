// Beranda Gamesku — hero carousel + shortcut + kategori + flash sale + katalog dari API.
// Search bar global ada di header (Navigasi); halaman ini tidak lagi punya
// search bar sendiri agar tidak ada dua kolom pencarian di layar yang sama.
import { Link } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import BannerUtama from '../komponen/BannerUtama.jsx'
import Kategori from '../komponen/Kategori.jsx'
import BagianProduk from '../komponen/BagianProduk.jsx'
import KartuProduk from '../komponen/KartuProduk.jsx'
import FlashSale from '../komponen/FlashSale.jsx'
import Streamku from '../komponen/StreamKU.jsx'
import KeadaanKosong from '../komponen/KeadaanKosong.jsx'
import Ikon from '../komponen/Ikon.jsx'
import useReveal from '../layanan/gunakanReveal.js'
import { daftarProdukDariApi } from '../layanan/layananProdukApi.js'
import { GalatAnime } from '../layanan/layananAnime.js'

const SHORTCUT = [
  { nama: 'Semua Item', ikon: 'unduhCepat', ke: '/store' },
  { nama: 'Promo', ikon: 'promo', ke: '/promo' },
  { nama: 'Gratis', ikon: 'gratis', ke: '/gratis' },
  { nama: 'Bantuan', ikon: 'perisai', ke: '/bantuan' },
]

const keunggulan = [
  { ikon: 'unduhCepat', judul: 'Temukan gaya kamu', deskripsi: 'Jelajahi item dari berbagai kategori dalam satu tempat.' },
  { ikon: 'perisai', judul: 'Detail yang jelas', deskripsi: 'Cek deskripsi dan versi produk sebelum memilih.' },
  { ikon: 'kreator', judul: 'Ruang untuk kreator', deskripsi: 'Temukan karya yang memberi warna baru ke permainanmu.' },
  { ikon: 'hati', judul: 'Simpan favoritmu', deskripsi: 'Kumpulkan pilihan di wishlist sambil menjelajah.' },
]

export default function Beranda() {
  const [katalog, setKatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kategoriAktif, setKategoriAktif] = useState('semua')

  useEffect(() => {
    let dibatalkan = false
    async function muatKatalog() {
      setLoading(true)
      setError('')
      try {
        const data = await daftarProdukDariApi()
        if (!dibatalkan) setKatalog(data)
      } catch (e) {
        if (!dibatalkan) setError(e instanceof GalatAnime ? e.message : 'Tidak dapat memuat katalog.')
      } finally {
        if (!dibatalkan) setLoading(false)
      }
    }
    muatKatalog()
    return () => { dibatalkan = true }
  }, [])

  // Data katalog dari API (bukan localStorage). Tamu hanya menerima status Aktif.
  const semua = katalog
  const promo = semua.filter((p) => p.hargaDiskon > 0 && p.hargaDiskon > p.harga)
  const terbaru = useMemo(() => [...semua]
    .sort((a, b) => String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || '')))
    .slice(0, 8), [semua])
  // Populer = produk diskon dulu, lalu produk biasa.
  const populer = useMemo(() => [...promo, ...semua.filter((p) => !(p.hargaDiskon > 0 && p.hargaDiskon > p.harga))].slice(0, 8), [semua, promo])
  const daftarNamaKategori = useMemo(() => {
    const unik = new Map()
    semua.forEach((p) => {
      const nama = String(p.kategoriNama || '').trim()
      if (nama && !unik.has(nama)) unik.set(nama, nama)
    })
    return ['semua', ...unik.keys()]
  }, [semua])
  const katalogTampil = useMemo(() => {
    if (kategoriAktif === 'semua') return semua
    return semua.filter((p) => String(p.kategoriNama || '') === kategoriAktif)
  }, [semua, kategoriAktif])
  // Pasang ulang observer saat loading selesai — node .reveal baru harus terpantau.
  useReveal(loading)

  const cobaLagi = () => {
    setLoading(true)
    setError('')
    daftarProdukDariApi()
      .then((data) => { if (data) setKatalog(data) })
      .catch((e) => setError(e instanceof GalatAnime ? e.message : 'Tidak dapat memuat katalog.'))
      .finally(() => setLoading(false))
  }

  const shortcut = (
    <div className="wadah">
      <nav className="gk-short reveal" aria-label="Layanan Gamesku">
        {SHORTCUT.map((s) => (
          <Link key={s.nama} to={s.ke}><span className="ic"><Ikon nama={s.ikon} ukuran={19} /></span>{s.nama}</Link>
        ))}
      </nav>
    </div>
  )

  if (loading) {
    return (
      <>
        <BannerUtama />
        {shortcut}
        <Kategori />
        <section className="bagian" aria-label="Memuat katalog">
          <div className="wadah">
            <div className="judul-bagian">
              <div><h2>Katalog Produk</h2><p>Memuat katalog dari server…</p></div>
            </div>
            <div className="kisi-produk" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="skel" />))}
            </div>
          </div>
        </section>
        <Streamku />
      </>
    )
  }

  return (
    <>
      <BannerUtama />
      {shortcut}
      <Kategori />
      <FlashSale daftar={promo} />
      <div className="reveal">
        <BagianProduk judul="Pilihan untuk next level." subjudul="Jelajahi item dan penawaran dari katalog kami." daftar={populer} tautan="/store" />
      </div>
      <section className="bagian reveal" aria-label="Katalog produk">
        <div className="wadah">
          <div className="judul-bagian">
            <div>
              <h2>Katalog Produk</h2>
              <p>{semua.length ? `${semua.length} item untuk melengkapi petualanganmu.` : 'Cari sesuatu yang cocok dengan gaya bermainmu.'}</p>
            </div>
            <Link className="tautan-lihat" to="/store">Lihat Semua<Ikon nama="panahKanan" ukuran={14} /></Link>
          </div>
          {error ? (
            <div className="sk-galat" role="alert">
              <div className="sk-galat-ikon" aria-hidden="true"><Ikon nama="info" ukuran={22} /></div>
              <div className="sk-galat-isi">
                <strong>Gagal memuat katalog</strong>
                <p>{error}</p>
                <button type="button" className="tombol tombol-utama tombol-kecil" onClick={cobaLagi}>Coba lagi</button>
              </div>
            </div>
          ) : semua.length === 0 ? (
            <KeadaanKosong
              ikon="kotak"
              judul="Katalog belum terisi"
              deskripsi="Koleksi baru sedang disiapkan. Jelajahi kategori atau kembali lagi nanti."
              teksTombol="Buka Store"
              tautanTombol="/store"
            />
          ) : (
            <>
              {daftarNamaKategori.length > 2 && (
                <div className="gk-pil-kategori" role="tablist" aria-label="Filter katalog per kategori">
                  {daftarNamaKategori.map((nama) => (
                    <button key={nama} type="button" role="tab" aria-selected={kategoriAktif === nama} className={kategoriAktif === nama ? 'pil-aktif pil' : 'pil'} onClick={() => setKategoriAktif(nama)}>
                      {nama === 'semua' ? 'Semua' : nama}
                    </button>
                  ))}
                </div>
              )}
              {katalogTampil.length === 0 ? (
                <KeadaanKosong ikon="cari" judul="Tidak ada produk pada kategori ini" deskripsi={`Kategori “${kategoriAktif}” belum memiliki produk aktif.`} />
              ) : (
                <div className="kisi-produk">
                  {katalogTampil.slice(0, 20).map((produk) => (<KartuProduk key={produk.id} produk={produk} />))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <Streamku />
      <div className="reveal">
        <BagianProduk judul="Rekomendasi Untukmu" subjudul="Rilisan terbaru dari kreator." daftar={terbaru} tautan="/store?urut=terbaru" />
      </div>
      <section className="bagian reveal" aria-label="Kenapa Gamesku">
        <div className="wadah">
          <div className="judul-bagian">
            <div><h2>Kenapa Gamesku?</h2><p>Belanja gaming yang cepat dan aman.</p></div>
          </div>
          <div className="gk-kenapa">
            {keunggulan.map((k) => (
              <div key={k.judul} className="gk-kenapa-kartu">
                <span className="gk-kenapa-ikon" aria-hidden="true"><Ikon nama={k.ikon} ukuran={20} /></span>
                <strong>{k.judul}</strong>
                <p>{k.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
