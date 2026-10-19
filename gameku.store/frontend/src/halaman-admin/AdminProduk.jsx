import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TabelData from '../komponen/admin/TabelData.jsx'
import ThumbnailProduk from '../komponen/admin/ThumbnailProduk.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import TombolAksi from '../komponen/admin/TombolAksi.jsx'
import Paginasi from '../komponen/admin/Paginasi.jsx'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import layananProduk, {
  hapusProduk,
  ubahStatusProduk,
} from '../layanan/layananProduk.js'
import layananKategori, { namaKategori } from '../layanan/layananKategori.js'
import { STATUS_PRODUK, gradasiOtomatis, waktuRelatif } from '../data/konstanta.js'
import { formatRupiah } from '../utilitas/format.js'
import '../css/admin-tabel.css'

const PER_HALAMAN = 8

// =====================================================================
// Halaman kelola produk (/admin/produk).
//
// Daftar dibaca dari service, bukan dari array yang ditulis di JSX.
// Belum ada produk => "Belum ada produk."
// =====================================================================
export default function AdminProduk() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { tampilkanPesan } = useAdmin()
  const [kata, setKata] = useState(params.get('cari') || '')
  const [filter, setFilter] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [dipilih, setDipilih] = useState(null)
  const [dihapus, setDihapus] = useState(null)

  // Data nyata dari service.
  const semua = useDaftar(layananProduk)
  const kategori = useDaftar(layananKategori)

  // Chip filter dibangun dari kategori yang benar-benar ada.
  const pilihanKategori = useMemo(() => ['Semua', ...kategori.map((k) => k.nama)], [kategori])

  const hasil = useMemo(() => {
    const kunci = kata.trim().toLowerCase()
    return semua.filter((p) => {
      const cocokKategori = !filter || filter === 'Semua' || namaKategori(p.kategoriId) === filter
      const cocokKata = !kunci || `${p.nama} ${p.creator} ${p.slug}`.toLowerCase().includes(kunci)
      return cocokKategori && cocokKata
    })
  }, [semua, kata, filter])

  const totalHalaman = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN))
  const halamanAman = Math.min(halaman, totalHalaman)
  const baris = hasil.slice((halamanAman - 1) * PER_HALAMAN, halamanAman * PER_HALAMAN)

  const konfirmasiHapus = () => {
    const hasilHapus = hapusProduk(dihapus.id)
    if (hasilHapus.berhasil) tampilkanPesan(`Produk "${dihapus.nama}" dihapus.`)
    setDihapus(null)
  }

  const gantiStatus = (produk, status) => {
    const hasilUbah = ubahStatusProduk(produk.id, status)
    if (hasilUbah.berhasil) {
      tampilkanPesan(`Status "${produk.nama}" diubah menjadi ${status}.`)
      setDipilih((p) => (p && p.id === produk.id ? { ...p, status } : p))
    }
  }

  const kolom = [
    {
      kunci: 'nama',
      label: 'Produk',
      render: (p, i) => (
        <span className="sel-produk">
          <ThumbnailProduk nama={p.nama} warna={gradasiOtomatis(i)} />
          <span className="sel-produk-teks">
            <strong>{p.nama}</strong>
            <span>oleh {p.creator || '—'}</span>
          </span>
        </span>
      ),
    },
    {
      kunci: 'kategoriId',
      label: 'Kategori',
      render: (p) => <span className="kategori-pill">{namaKategori(p.kategoriId) || '—'}</span>,
    },
    {
      kunci: 'harga',
      label: 'Harga',
      rata: 'sel-kanan',
      render: (p) => (
        <span className="nominal">{Number(p.harga) === 0 ? 'Gratis' : formatRupiah(p.harga)}</span>
      ),
    },
    { kunci: 'status', label: 'Status', render: (p) => <LencanaStatus status={p.status} /> },
    {
      kunci: 'dibuatPada',
      label: 'Tanggal',
      render: (p) => <span className="teks-redup teks-kecil">{waktuRelatif(p.dibuatPada)}</span>,
    },
    {
      kunci: 'aksi',
      label: 'Aksi',
      rata: 'sel-kanan',
      render: (p) => (
        <span className="baris-aksi" onClick={(e) => e.stopPropagation()}>
          <TombolAksi ikon="lihat" label="Lihat" jenis="utama" padaKlik={() => setDipilih(p)} />
          <TombolAksi
            ikon="edit"
            label="Edit"
            padaKlik={() => navigate(`/admin/produk/tambah?edit=${p.id}`)}
          />
          <TombolAksi ikon="hapus" label="Hapus" jenis="bahaya" padaKlik={() => setDihapus(p)} />
        </span>
      ),
    },
  ]


  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Produk</h2>
          <p>
            {semua.length === 0
              ? 'Belum ada produk di katalog'
              : `${semua.length} produk terdaftar di katalog Gamesku`}
          </p>
        </div>
        <div className="panel-aksi">
          <Link to="/admin/produk/tambah" className="tombol-admin tombol-hijau">
            <Ikon nama="tambah" ukuran={16} />
            Tambah Produk
          </Link>
        </div>
      </div>

      {/* Tanpa kategori, produk tidak bisa dibuat — arahkan admin ke sana. */}
      {!kategori.length && (
        <div className="pesan-salah-login" role="status" style={{ marginBottom: 18 }}>
          <Ikon nama="info" ukuran={16} />
          Buat minimal satu kategori terlebih dahulu sebelum menambah produk.
        </div>
      )}

      {semua.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="kotak"
            judul="Belum ada produk"
            deskripsi="Tambahkan produk pertama untuk mulai mengisi Gamesku."
            aksi={{ label: '+ Tambah Produk', ke: '/admin/produk/tambah' }}
          />
        </section>
      ) : (
        <>
          <div className="alat-baris">
            <span className="cari-panel">
              <Ikon nama="cari" ukuran={16} />
              <input
                type="search"
                value={kata}
                onChange={(e) => {
                  setKata(e.target.value)
                  setHalaman(1)
                }}
                placeholder="Cari nama, creator, slug…"
                aria-label="Cari produk"
              />
            </span>
            {pilihanKategori.length > 1 && (
              <div className="chip-filter">
                {pilihanKategori.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip ${filter === f ? 'aktif' : ''}`}
                    onClick={() => {
                      setFilter(f)
                      setHalaman(1)
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          <section className="kartu-panel">
            <TabelData
              kolom={kolom}
              baris={baris}
              pesanKosong="Tidak ada produk yang cocok dengan pencarian atau filter ini."
            />
            <Paginasi
              halaman={halamanAman}
              totalHalaman={totalHalaman}
              ubahHalaman={setHalaman}
              totalBaris={hasil.length}
              perHalaman={PER_HALAMAN}
              label="produk"
            />
          </section>
        </>
      )}

      <JendelaModal
        judul="Detail Produk"
        padaTutup={dipilih ? () => setDipilih(null) : null}
        ukuran="lebar"
        kaki={
          <>
            <button
              type="button"
              className="tombol-admin tombol-garis"
              onClick={() => setDipilih(null)}
            >
              Tutup
            </button>
            <button
              type="button"
              className="tombol-admin tombol-hijau"
              onClick={() => navigate(`/admin/produk/tambah?edit=${dipilih.id}`)}
            >
              <Ikon nama="edit" ukuran={15} />
              Edit Produk
            </button>
          </>
        }
      >
        {dipilih && (
          <>
            <div className="sel-produk" style={{ marginBottom: 18 }}>
              <ThumbnailProduk nama={dipilih.nama} warna={gradasiOtomatis(0)} ukuran={64} />
              <span className="sel-produk-teks">
                <strong style={{ fontSize: 17 }}>{dipilih.nama}</strong>
                <span>/{dipilih.slug}</span>
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <LencanaStatus status={dipilih.status} />
              </span>
            </div>
            <div className="daftar-detail">
              <div className="baris-detail">
                <span className="k">Kategori</span>
                <span className="v">{namaKategori(dipilih.kategoriId) || '—'}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Jenis Produk</span>
                <span className="v">{dipilih.jenis}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Harga</span>
                <span className="v">
                  {Number(dipilih.harga) === 0 ? 'Gratis' : formatRupiah(dipilih.harga)}
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Harga coret</span>
                <span className="v">
                  {Number(dipilih.hargaDiskon) > 0 ? formatRupiah(dipilih.hargaDiskon) : '—'}
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Creator</span>
                <span className="v">{dipilih.creator || '—'}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Versi Minecraft</span>
                <span className="v">{dipilih.versiMinecraft || '—'}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Status</span>
                <span className="v">{dipilih.status}</span>
              </div>
            </div>
            {dipilih.deskripsiSingkat && (
              <p
                style={{
                  marginTop: 16,
                  color: 'var(--adm-redup)',
                  fontSize: 13.4,
                  lineHeight: 1.65,
                }}
              >
                {dipilih.deskripsiSingkat}
              </p>
            )}

            <div className="blok-form" style={{ marginTop: 18, marginBottom: 0 }}>
              <label className="label-form" htmlFor="ubah-status-produk">
                Ubah status produk
              </label>
              <select
                id="ubah-status-produk"
                className="pilih-admin"
                value={dipilih.status}
                onChange={(e) => gantiStatus(dipilih, e.target.value)}
              >
                {STATUS_PRODUK.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </JendelaModal>

      <JendelaModal
        judul="Hapus Produk?"
        padaTutup={dihapus ? () => setDihapus(null) : null}
        ukuran="kecil"
        kaki={
          <>
            <button
              type="button"
              className="tombol-admin tombol-garis"
              onClick={() => setDihapus(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="tombol-admin tombol-bahaya"
              onClick={konfirmasiHapus}
            >
              <Ikon nama="hapus" ukuran={15} />
              Ya, Hapus
            </button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13.8, lineHeight: 1.65 }}>
          Produk <b>{dihapus?.nama}</b> akan dihapus dari katalog. Tindakan ini
          tidak dapat dibatalkan.
        </p>
      </JendelaModal>
    </>
  )
}
