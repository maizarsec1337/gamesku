import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import {
  daftarKategoriApi,
  daftarCreatorApi,
  ambilProdukApi,
  buatProdukApi,
  ubahProdukApi,
} from '../layanan/apiAdmin.js'
import { JENIS_PRODUK, STATUS_PRODUK, gradasiOtomatis, jadikanSlug } from '../data/konstanta.js'
import { formatRupiah } from '../utilitas/format.js'
import '../css/admin-form.css'
import '../css/admin-tabel.css'

const formKosong = () => ({
  nama: '',
  slug: '',
  kategoriId: '',
  jenis: JENIS_PRODUK[0],
  deskripsiSingkat: '',
  deskripsiLengkap: '',
  harga: 0,
  hargaDiskon: 0,
  thumbnail: '',
  preview: [],
  fileProduk: '',
  versiMinecraft: '',
  creator: '',
  status: 'Draft',
})

// Tambah / Edit produk (/admin/produk/tambah?edit=<id>) — tersambung ke backend.
export default function AdminProdukTambah() {
  const [params] = useSearchParams()
  return <EditorProduk key={params.get('edit') || 'baru'} />
}

function EditorProduk() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { tampilkanPesan } = useAdmin()

  const idEdit = params.get('edit')
  const { data: asli, memuat: memuatAsli, galat: galatAsli, muat: muatAsli } = useApi(
    () => (idEdit ? ambilProdukApi(idEdit) : Promise.resolve(null)),
    [idEdit],
  )
  const { data: dataKategori, memuat: memuatKategori, galat: galatKategori, muat: muatKategori } = useApi(() => daftarKategoriApi(), [])
  const { data: dataCreator } = useApi(() => daftarCreatorApi(), [])
  const kategori = Array.isArray(dataKategori) ? dataKategori : []
  const daftarCreator = Array.isArray(dataCreator)
    ? [...new Set(dataCreator.map((c) => c.nama).filter(Boolean))].sort()
    : []

  const [form, setForm] = useState(formKosong)
  const [slugDisentuh, setSlugDisentuh] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)

  // Isi formulir dari data server saat mode edit.
  useEffect(() => {
    if (!asli) return
    setForm({
      nama: asli.nama || '',
      slug: asli.slug || '',
      kategoriId: asli.kategoriId || '',
      jenis: asli.jenis || JENIS_PRODUK[0],
      deskripsiSingkat: asli.deskripsiSingkat || '',
      deskripsiLengkap: asli.deskripsiLengkap || '',
      harga: asli.harga || 0,
      hargaDiskon: asli.hargaDiskon || 0,
      thumbnail: asli.thumbnail || '',
      preview: Array.isArray(asli.preview) ? asli.preview : [],
      fileProduk: asli.fileProduk || '',
      versiMinecraft: asli.versiMinecraft || '',
      creator: asli.creator || '',
      status: asli.status || 'Draft',
    })
    setSlugDisentuh(true)
  }, [asli])

  const ubah = (kunci, nilai) => setForm((f) => ({ ...f, [kunci]: nilai }))

  const ubahNama = (nilai) => {
    setForm((f) => ({ ...f, nama: nilai, slug: slugDisentuh ? f.slug : jadikanSlug(nilai) }))
  }

  const simpan = async (status) => {
    if (menyimpan || memuatAsli || memuatKategori || galatAsli || galatKategori) return
    const isi = { ...form, status }
    setMenyimpan(true)
    try {
      if (idEdit) await ubahProdukApi(idEdit, isi)
      else await buatProdukApi(isi)
      tampilkanPesan(`Produk "${isi.nama}" ${idEdit ? 'diperbarui' : 'disimpan'} sebagai ${status}.`)
      navigate('/admin/produk')
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    } finally {
      setMenyimpan(false)
    }
  }

  if (memuatAsli || memuatKategori) return <div role="status">Memuat formulir produk…</div>
  if (galatAsli || galatKategori) {
    return (
      <div className="pesan-salah-login" role="alert">
        {pesanGalat(galatAsli || galatKategori)}
        <button type="button" className="tombol-admin tombol-garis" onClick={galatAsli ? muatAsli : muatKategori}>Coba lagi</button>
      </div>
    )
  }

  // Tanpa kategori, produk tidak bisa disimpan.
  if (!kategori.length) {
    return (
      <>
        <div className="judul-halaman">
          <div>
            <h2>Tambah Produk</h2>
            <p>Kategori harus dibuat lebih dulu</p>
          </div>
          <div className="panel-aksi">
            <Link to="/admin/produk" className="tombol-admin tombol-garis">
              <Ikon nama="panahKiri" ukuran={15} />
              Kembali
            </Link>
          </div>
        </div>
        <section className="kartu-panel">
          <KosongAdmin
            ikon="kategori"
            judul="Belum ada kategori."
            deskripsi="Produk harus punya kategori. Buat kategori terlebih dahulu."
            aksi={{ label: '+ Tambah Kategori', ke: '/admin/kategori' }}
          />
        </section>
      </>
    )
  }

  const namaKategoriTerpilih = kategori.find((k) => k.id === form.kategoriId)?.nama || '—'

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>{idEdit ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <p>
            {idEdit
              ? `Memperbarui "${asli?.nama || ''}"${memuatAsli ? '…' : ''}`
              : 'Lengkapi detail konten Minecraft untuk diterbitkan'}
          </p>
        </div>
        <div className="panel-aksi">
          <Link to="/admin/produk" className="tombol-admin tombol-garis">
            <Ikon nama="panahKiri" ukuran={15} />
            Kembali
          </Link>
        </div>
      </div>

      <div className="form-produk">
        <div>
          <section className="kartu-panel" style={{ marginBottom: 18 }}>
            <div className="panel-kepala">
              <div>
                <h3 className="panel-judul">Informasi Produk</h3>
                <p className="panel-sub">Judul, URL, kategori, dan deskripsi</p>
              </div>
            </div>
            <div className="panel-badan">
              <div className="blok-form">
                <label className="label-form" htmlFor="pr-nama">
                  Nama Produk <span className="wajib">*</span>
                </label>
                <input
                  id="pr-nama"
                  className="isian-admin"
                  value={form.nama}
                  onChange={(e) => ubahNama(e.target.value)}
                  placeholder="Nama produk Minecraft"
                  autoFocus
                />
              </div>

              <div className="baris-form">
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-slug">Slug</label>
                  <input
                    id="pr-slug"
                    className="isian-admin"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugDisentuh(true)
                      ubah('slug', e.target.value)
                    }}
                    placeholder="otomatis-dari-nama"
                  />
                  <p className="bantuan-form">Tautan: /produk/{form.slug || 'nama-produk'}</p>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-kategori">
                    Kategori <span className="wajib">*</span>
                  </label>
                  <select
                    id="pr-kategori"
                    className="pilih-admin"
                    value={form.kategoriId}
                    onChange={(e) => ubah('kategoriId', e.target.value)}
                  >
                    <option value="">— Pilih kategori —</option>
                    {kategori.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="baris-form">
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-jenis">Jenis Produk</label>
                  <select
                    id="pr-jenis"
                    className="pilih-admin"
                    value={form.jenis}
                    onChange={(e) => ubah('jenis', e.target.value)}
                  >
                    {JENIS_PRODUK.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-creator">
                    Creator <span className="wajib">*</span>
                  </label>
                  <input
                    id="pr-creator"
                    className="isian-admin"
                    list="daftar-creator"
                    value={form.creator}
                    onChange={(e) => ubah('creator', e.target.value)}
                    placeholder="Nama creator"
                  />
                  <datalist id="daftar-creator">
                    {daftarCreator.map((nama) => (
                      <option key={nama} value={nama} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="blok-form">
                <label className="label-form" htmlFor="pr-desk-singkat">Deskripsi Singkat</label>
                <input
                  id="pr-desk-singkat"
                  className="isian-admin"
                  value={form.deskripsiSingkat}
                  onChange={(e) => ubah('deskripsiSingkat', e.target.value)}
                  placeholder="Ringkasan satu baris untuk kartu produk"
                />
              </div>

              <div className="blok-form" style={{ marginBottom: 0 }}>
                <label className="label-form" htmlFor="pr-desk-lengkap">Deskripsi Lengkap</label>
                <textarea
                  id="pr-desk-lengkap"
                  className="area-teks-admin"
                  style={{ minHeight: 140 }}
                  value={form.deskripsiLengkap}
                  onChange={(e) => ubah('deskripsiLengkap', e.target.value)}
                  placeholder="Jelaskan isi konten, fitur, dan keunggulannya…"
                />
                <p className="bantuan-form">{form.deskripsiLengkap.length} karakter</p>
              </div>
            </div>
          </section>

          <section className="kartu-panel" style={{ marginBottom: 18 }}>
            <div className="panel-kepala">
              <div>
                <h3 className="panel-judul">Harga &amp; Diskon</h3>
                <p className="panel-sub">Harga jual dalam Rupiah</p>
              </div>
            </div>
            <div className="panel-badan">
              <div className="baris-form">
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-harga">
                    Harga <span className="wajib">*</span>
                  </label>
                  <input
                    id="pr-harga"
                    type="number"
                    min="0"
                    step="1000"
                    className="isian-admin rupiah"
                    value={form.harga}
                    onChange={(e) => ubah('harga', e.target.value)}
                  />
                  <p className="bantuan-form">
                    Tertera:{' '}
                    {Number(form.harga) === 0 ? 'Gratis' : formatRupiah(form.harga)}
                  </p>
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-diskon">Harga Diskon</label>
                  <input
                    id="pr-diskon"
                    type="number"
                    min="0"
                    step="1000"
                    className="isian-admin rupiah"
                    value={form.hargaDiskon}
                    onChange={(e) => ubah('hargaDiskon', e.target.value)}
                  />
                  <p className="bantuan-form">0 = tanpa harga coret.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="kartu-panel" style={{ marginBottom: 18 }}>
            <div className="panel-kepala">
              <div>
                <h3 className="panel-judul">Detail Konten</h3>
                <p className="panel-sub">Versi Minecraft dan status</p>
              </div>
            </div>
            <div className="panel-badan">
              <div className="baris-form">
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-versi">Versi Minecraft</label>
                  <input
                    id="pr-versi"
                    className="isian-admin"
                    value={form.versiMinecraft}
                    onChange={(e) => ubah('versiMinecraft', e.target.value)}
                    placeholder="Contoh: 1.20.x, 1.21.x"
                  />
                </div>
                <div className="blok-form">
                  <label className="label-form" htmlFor="pr-status">Status</label>
                  <select
                    id="pr-status"
                    className="pilih-admin"
                    value={form.status}
                    onChange={(e) => ubah('status', e.target.value)}
                  >
                    {STATUS_PRODUK.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="kartu-panel">
            <div className="panel-kepala">
              <div>
                <h3 className="panel-judul">Media &amp; Berkas</h3>
                <p className="panel-sub">URL thumbnail, preview, dan file unduhan</p>
              </div>
            </div>
            <div className="panel-badan">
              <div className="blok-form">
                <label className="label-form" htmlFor="pr-thumb">URL Thumbnail</label>
                <input
                  id="pr-thumb"
                  className="isian-admin"
                  value={form.thumbnail}
                  onChange={(e) => ubah('thumbnail', e.target.value)}
                  placeholder="/uploads/… atau https://…"
                />
              </div>
              <div className="blok-form">
                <label className="label-form" htmlFor="pr-preview">URL Gambar Preview (satu per baris)</label>
                <textarea
                  id="pr-preview"
                  className="area-teks-admin"
                  style={{ minHeight: 90 }}
                  value={form.preview.join('\n')}
                  onChange={(e) =>
                    ubah('preview', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
                  }
                  placeholder={'https://…/preview-1.jpg\nhttps://…/preview-2.jpg'}
                />
              </div>
              <div className="blok-form" style={{ marginBottom: 0 }}>
                <label className="label-form" htmlFor="pr-file">URL File Produk</label>
                <input
                  id="pr-file"
                  className="isian-admin"
                  value={form.fileProduk}
                  onChange={(e) => ubah('fileProduk', e.target.value)}
                  placeholder="/uploads/… (zip/mcaddon)"
                />
                <p className="bantuan-form">
                  Unggah berkas lewat menu Media, lalu tempel URL-nya di sini.
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="kartu-panel ringkasan-produk">
          <div className="panel-kepala">
            <div>
              <h3 className="panel-judul">Ringkasan</h3>
              <p className="panel-sub">Pratinjau tampilan toko</p>
            </div>
            <LencanaStatus status={form.status} />
          </div>
          <div className="panel-badan">
            <div
              className="pratinjau-besar"
              style={{ background: `linear-gradient(135deg, ${gradasiOtomatis(0)[0]}, ${gradasiOtomatis(0)[1]})` }}
            >
              {(form.nama.trim()[0] || '?').toUpperCase()}
            </div>
            <div className="daftar-detail" style={{ gridTemplateColumns: '1fr' }}>
              <div className="baris-detail">
                <span className="k">Nama</span>
                <span className="v">{form.nama.trim() || 'Tanpa judul'}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Kategori</span>
                <span className="v">{namaKategoriTerpilih}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Jenis</span>
                <span className="v">{form.jenis}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Harga</span>
                <span className="v">
                  {Number(form.harga) === 0 ? 'Gratis' : formatRupiah(form.harga)}
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Harga coret</span>
                <span className="v">
                  {Number(form.hargaDiskon) > 0 ? formatRupiah(form.hargaDiskon) : '—'}
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Creator</span>
                <span className="v">{form.creator || '—'}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Versi</span>
                <span className="v">{form.versiMinecraft || '—'}</span>
              </div>
            </div>
          </div>
          <div
            className="baris-ringkas-admin"
            style={{
              borderTop: '1px solid var(--adm-border)',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 10,
            }}
          >
            <div className="kaki-form-produk">
              <button
                type="button"
                className="tombol-admin tombol-garis"
                onClick={() => simpan('Draft')}
                disabled={menyimpan}
              >
                <Ikon nama="simpan" ukuran={15} />
                Simpan Draft
              </button>
              <button
                type="button"
                className="tombol-admin tombol-hijau"
                onClick={() => simpan('Aktif')}
                disabled={menyimpan}
              >
                <Ikon nama="cek" ukuran={15} />
                {menyimpan ? 'Menyimpan…' : 'Simpan Produk'}
              </button>
            </div>
            <span className="teks-redup teks-kecil" style={{ textAlign: 'center' }}>
              Data dikirim ke backend (POST/PUT /api/produk).
            </span>
          </div>
        </aside>
      </div>
    </>
  )
}
