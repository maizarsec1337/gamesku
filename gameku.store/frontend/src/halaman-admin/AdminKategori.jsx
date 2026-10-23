import { useMemo, useState } from 'react'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import TombolAksi from '../komponen/admin/TombolAksi.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import {
  daftarKategoriApi,
  buatKategoriApi,
  ubahKategoriApi,
  hapusKategoriApi,
  daftarProdukApi,
} from '../layanan/apiAdmin.js'
import { STATUS_KATEGORI, IKON_KATEGORI } from '../data/konstanta.js'
import '../css/admin-tabel.css'

const formKosong = { nama: '', slug: '', deskripsi: '', ikon: 'kategori', gambar: '', status: STATUS_KATEGORI[0] }

// Halaman kategori (/admin/kategori) — data dari backend (GET/POST/PUT/DELETE /api/kategori).
export default function AdminKategori() {
  const { tampilkanPesan } = useAdmin()
  const { data, memuat, galat, muat } = useApi(() => daftarKategoriApi(), [])
  const { data: dataProduk } = useApi(() => daftarProdukApi({ batas: 200 }), [])
  const kategori = Array.isArray(data) ? data : []

  const jumlahProduk = useMemo(() => {
    const daftar = Array.isArray(dataProduk) ? dataProduk : []
    const hitung = {}
    for (const p of daftar) hitung[p.kategoriId] = (hitung[p.kategoriId] || 0) + 1
    return hitung
  }, [dataProduk])

  const [form, setForm] = useState(formKosong)
  const [mode, setMode] = useState(null) // 'baru' | id kategori | null
  const [dihapus, setDihapus] = useState(null)
  const [menyimpan, setMenyimpan] = useState(false)

  const bukaTambah = () => {
    setForm(formKosong)
    setMode('baru')
  }

  const bukaEdit = (k) => {
    setForm({
      nama: k.nama,
      slug: k.slug,
      deskripsi: k.deskripsi || '',
      ikon: k.ikon,
      gambar: k.gambar || '',
      status: k.status,
    })
    setMode(k.id)
  }

  const simpan = async (e) => {
    e.preventDefault()
    if (menyimpan) return
    setMenyimpan(true)
    try {
      const hasil = mode === 'baru' ? await buatKategoriApi(form) : await ubahKategoriApi(mode, form)
      await muat()
      tampilkanPesan(
        mode === 'baru'
          ? `Kategori "${hasil?.nama || form.nama}" ditambahkan.`
          : `Kategori "${hasil?.nama || form.nama}" diperbarui.`,
      )
      setMode(null)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    } finally {
      setMenyimpan(false)
    }
  }

  const konfirmasiHapus = async () => {
    try {
      await hapusKategoriApi(dihapus.id)
      await muat()
      tampilkanPesan(`Kategori "${dihapus.nama}" dihapus.`)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    }
    setDihapus(null)
  }

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat kategori…</p>
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
          <h2>Kategori</h2>
          <p>
            {kategori.length === 0
              ? 'Belum ada kategori'
              : `${kategori.length} kategori di katalog Gamesku`}
          </p>
        </div>
        <div className="panel-aksi">
          <button type="button" className="tombol-admin tombol-hijau" onClick={bukaTambah}>
            <Ikon nama="tambah" ukuran={16} />
            Tambah Kategori
          </button>
        </div>
      </div>

      {kategori.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="kategori"
            judul="Belum ada kategori."
            deskripsi="Buat kategori pertama, lalu gunakan pada form Tambah Produk."
            aksi={{ label: '+ Tambah Kategori', onKlik: bukaTambah }}
          />
        </section>
      ) : (
        <div className="kisi-kategori">
          {kategori.map((k) => (
            <article key={k.id} className="kartu-kategori">
              <span className="kartu-kategori-ikon">
                <Ikon nama={k.ikon} ukuran={21} />
              </span>
              <h3>{k.nama}</h3>
              <span className="slug-kategori">/{k.slug}</span>
              <p>{k.deskripsi || 'Tanpa deskripsi.'}</p>
              <div className="kartu-kategori-kaki">
                <span className="jumlah-produk">
                  <b>{jumlahProduk[k.id] || 0}</b> produk
                </span>
                <span className="baris-aksi">
                  <TombolAksi ikon="edit" label="Edit" jenis="utama" padaKlik={() => bukaEdit(k)} />
                  <TombolAksi ikon="hapus" label="Hapus" jenis="bahaya" padaKlik={() => setDihapus(k)} />
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <LencanaStatus status={k.status} />
              </div>
            </article>
          ))}

          <button type="button" className="tombol-tambah-kategori" onClick={bukaTambah}>
            <Ikon nama="tambah" ukuran={26} />
            <span>Tambah Kategori Baru</span>
          </button>
        </div>
      )}

      <JendelaModal
        judul={mode === 'baru' ? 'Tambah Kategori' : 'Edit Kategori'}
        padaTutup={mode ? () => setMode(null) : null}
        ukuran="kecil"
        kaki={
          <>
            <button type="button" className="tombol-admin tombol-garis" onClick={() => setMode(null)}>
              Batal
            </button>
            <button type="submit" form="form-kategori" className="tombol-admin tombol-hijau" disabled={menyimpan}>
              <Ikon nama="simpan" ukuran={15} />
              {menyimpan ? 'Menyimpan…' : 'Simpan Kategori'}
            </button>
          </>
        }
      >
        <form id="form-kategori" onSubmit={simpan}>
          <div className="blok-form">
            <label className="label-form" htmlFor="kat-nama">
              Nama Kategori <span className="wajib">*</span>
            </label>
            <input
              id="kat-nama"
              className="isian-admin"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              placeholder="Nama kategori produk"
              autoFocus
            />
          </div>

          <div className="blok-form">
            <label className="label-form" htmlFor="kat-slug">Slug</label>
            <input
              id="kat-slug"
              className="isian-admin"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="otomatis-dari-nama"
            />
            <p className="bantuan-form">Dipakai sebagai URL: /kategori/{form.slug || 'slug'}</p>
          </div>

          <div className="blok-form">
            <label className="label-form" htmlFor="kat-desk">Deskripsi</label>
            <textarea
              id="kat-desk"
              className="area-teks-admin"
              style={{ minHeight: 90 }}
              value={form.deskripsi}
              onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
              placeholder="Penjelasan singkat kategori ini…"
            />
          </div>

          <div className="baris-form">
            <div className="blok-form">
              <label className="label-form" htmlFor="kat-ikon">Ikon</label>
              <select
                id="kat-ikon"
                className="pilih-admin"
                value={form.ikon}
                onChange={(e) => setForm((f) => ({ ...f, ikon: e.target.value }))}
              >
                {IKON_KATEGORI.map((ikon) => (
                  <option key={ikon} value={ikon}>{ikon}</option>
                ))}
              </select>
            </div>
            <div className="blok-form">
              <label className="label-form" htmlFor="kat-status">Status</label>
              <select
                id="kat-status"
                className="pilih-admin"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_KATEGORI.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="blok-form" style={{ marginBottom: 0 }}>
            <label className="label-form" htmlFor="kat-gambar">Gambar Kategori (URL)</label>
            <input
              id="kat-gambar"
              className="isian-admin"
              value={form.gambar}
              onChange={(e) => setForm((f) => ({ ...f, gambar: e.target.value }))}
              placeholder="/uploads/… atau https://…"
            />
            <p className="bantuan-form">Unggah berkas ada di menu Media; tempel URL-nya di sini.</p>
          </div>
        </form>
      </JendelaModal>

      <JendelaModal
        judul="Hapus Kategori?"
        padaTutup={dihapus ? () => setDihapus(null) : null}
        ukuran="kecil"
        kaki={
          <>
            <button type="button" className="tombol-admin tombol-garis" onClick={() => setDihapus(null)}>
              Batal
            </button>
            <button type="button" className="tombol-admin tombol-bahaya" onClick={konfirmasiHapus}>
              <Ikon nama="hapus" ukuran={15} />
              Ya, Hapus
            </button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13.8, lineHeight: 1.65 }}>
          Kategori <b>{dihapus?.nama}</b> akan dihapus dari katalog. Produk yang
          memakai kategori ini tidak ikut terhapus.
        </p>
      </JendelaModal>
    </>
  )
}
