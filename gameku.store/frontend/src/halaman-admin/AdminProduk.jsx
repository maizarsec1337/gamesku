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
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import {
  daftarProdukApi,
  daftarKategoriApi,
  hapusProdukApi,
} from '../layanan/apiAdmin.js'
import { gradasiOtomatis, waktuRelatif } from '../data/konstanta.js'
import { formatRupiah } from '../utilitas/format.js'
import '../css/admin-tabel.css'

const PER_HALAMAN = 8

// Halaman kelola produk (/admin/produk) — data dari backend (GET/PUT/DELETE /api/produk).
export default function AdminProduk() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { tampilkanPesan } = useAdmin()
  const { data, memuat, galat, muat } = useApi(() => daftarProdukApi({ batas: 200 }), [])
  const { data: dataKategori } = useApi(() => daftarKategoriApi(), [])
  const semua = Array.isArray(data) ? data : []
  const kategori = Array.isArray(dataKategori) ? dataKategori : []

  const kata = params.get('cari') || ''
  const setKata = (nilai) => {
    const baru = new URLSearchParams(params)
    if (nilai) baru.set('cari', nilai)
    else baru.delete('cari')
    setParams(baru, { replace: true })
  }
  const [filter, setFilter] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [dipilih, setDipilih] = useState(null)
  const [dihapus, setDihapus] = useState(null)

  // Peta id → nama kategori (dari server) untuk kolom & filter.
  const petaKategori = useMemo(() => {
    const peta = {}
    for (const k of kategori) peta[k.id] = k.nama
    return peta
  }, [kategori])

  const pilihanKategori = useMemo(() => ['Semua', ...kategori.map((k) => k.nama)], [kategori])

  const hasil = useMemo(() => {
    const kunci = kata.trim().toLowerCase()
    return semua.filter((p) => {
      const cocokKategori = !filter || filter === 'Semua' || petaKategori[p.kategoriId] === filter
      const cocokKata = !kunci || `${p.nama} ${p.creator} ${p.slug}`.toLowerCase().includes(kunci)
      return cocokKategori && cocokKata
    })
  }, [semua, kata, filter, petaKategori])

  const totalHalaman = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN))
  const halamanAman = Math.min(halaman, totalHalaman)
  const baris = hasil.slice((halamanAman - 1) * PER_HALAMAN, halamanAman * PER_HALAMAN)

  const konfirmasiHapus = async () => {
    try {
      await hapusProdukApi(dihapus.id)
      await muat()
      tampilkanPesan(`Produk "${dihapus.nama}" dihapus.`)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    }
    setDihapus(null)
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
      render: (p) => <span className="kategori-pill">{petaKategori[p.kategoriId] || '—'}</span>,
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

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat produk…</p>
      </div>
    )
  }

  if (galat) {
    return (
      <div className="pesan-salah-login" role="alert">
        <Ikon nama="info" ukuran={16} />
        {pesanGalat(galat)}
        <button type="button" className="tombol-admin tombol-garis" style={{ marginLeft: 'auto' }} onClick={muat}>
          Coba lagi
        </button>
      </div>
    )
  }

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
                <span className="v">{petaKategori[dipilih.kategoriId] || '—'}</span>
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
              <span className="label-form">Status produk</span>
              <p className="bantuan-form" style={{ marginTop: 6 }}>
                Status saat ini: <b>{dipilih.status}</b>. Ubah status lewat formulir
                Edit Produk agar seluruh data produk tersimpan utuh.
              </p>
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
