import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Ikon from '../komponen/Ikon.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import {
  formKosong,
  tambahProduk,
  perbaruiProduk,
  ambilProdukId,
} from '../layanan/layananProduk.js'
import { namaKategori } from '../layanan/layananKategori.js'
import layananKategori from '../layanan/layananKategori.js'
import layananCreator from '../layanan/layananCreator.js'
import {
  JENIS_PRODUK,
  STATUS_PRODUK,
  gradasiOtomatis,
  jadikanSlug,
} from '../data/konstanta.js'
import { formatRupiah } from '../utilitas/format.js'
import '../css/admin-form.css'
import '../css/admin-tabel.css'

// =====================================================================
// Tambah / Edit produk (/admin/produk/tambah?edit=<id>).
//
// Daftar kategori diambil dari layananKategori — kategori yang dibuat
// admin di /admin/kategori langsung tersedia di sini.
// =====================================================================
export default function AdminProdukTambah() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { tampilkanPesan } = useAdmin()

  const idEdit = params.get('edit')
  const asli = idEdit ? ambilProdukId(idEdit) : null

  const kategori = useDaftar(layananKategori)
  const daftarCreator = useDaftar(layananCreator, 'namaCreator')

  const [form, setForm] = useState(() => ({ ...formKosong(), ...(asli || {}) }))
  const [slugDisentuh, setSlugDisentuh] = useState(Boolean(asli))
  const [thumbnail, setThumbnail] = useState(asli?.thumbnail || '')
  const [preview, setPreview] = useState(asli?.preview || [])
  const [fileProduk, setFileProduk] = useState(asli?.fileProduk || '')

  const ubah = (kunci, nilai) => setForm((f) => ({ ...f, [kunci]: nilai }))

  const ubahNama = (nilai) => {
    setForm((f) => ({ ...f, nama: nilai, slug: slugDisentuh ? f.slug : jadikanSlug(nilai) }))
  }

  const pilihBerkas = (kunci, e) => {
    const berkas = e.target.files?.[0]
    if (!berkas) return
    if (kunci === 'thumbnail') setThumbnail(berkas.name)
    else if (kunci === 'preview') setPreview((lama) => [...lama, berkas.name].slice(0, 5))
    else setFileProduk(berkas.name)
    tampilkanPesan(`Berkas "${berkas.name}" dipilih.`)
    e.target.value = ''
  }

  const simpan = (status) => {
    const isi = {
      ...form,
      status,
      thumbnail,
      preview,
      fileProduk,
    }
    const hasil = asli ? perbaruiProduk(asli.id, isi) : tambahProduk(isi)
    if (!hasil.berhasil) {
      tampilkanPesan(hasil.pesan)
      return
    }
    tampilkanPesan(
      `Produk "${hasil.data.nama}" ${asli ? 'diperbarui' : 'disimpan'} sebagai ${status}.`,
    )
    navigate('/admin/produk')
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

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>{asli ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <p>
            {asli
              ? `Memperbarui "${asli.nama}"`
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
                <p className="panel-sub">Thumbnail, preview galeri, dan file unduhan</p>
              </div>
            </div>
            <div className="panel-badan">
              <div className="blok-upload-ganda">
                <div className="blok-form">
                  <span className="label-form">Thumbnail</span>
                  <label className={`area-unggah ${thumbnail ? 'terisi' : ''}`}>
                    <Ikon nama="gambar" ukuran={22} />
                    <strong>{thumbnail ? 'Thumbnail dipilih' : 'Pilih thumbnail'}</strong>
                    <span>PNG/JPG 1280×720</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => pilihBerkas('thumbnail', e)}
                    />
                  </label>
                  {thumbnail && (
                    <span className="berkas-pilih">
                      <Ikon nama="cek" ukuran={15} />
                      <span>{thumbnail}</span>
                    </span>
                  )}
                </div>
                <div className="blok-form">
                  <span className="label-form">Gambar Preview</span>
                  <label className={`area-unggah ${preview.length ? 'terisi' : ''}`}>
                    <Ikon nama="media" ukuran={22} />
                    <strong>
                      {preview.length ? `${preview.length} gambar dipilih` : 'Pilih gambar preview'}
                    </strong>
                    <span>Maksimal 5 gambar</span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => pilihBerkas('preview', e)}
                    />
                  </label>
                  {preview.length > 0 && (
                    <span className="berkas-pilih">
                      <Ikon nama="cek" ukuran={15} />
                      <span>{preview.join(', ')}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="blok-form" style={{ marginBottom: 0, marginTop: 4 }}>
                <span className="label-form">File Produk</span>
                <label className={`area-unggah ${fileProduk ? 'terisi' : ''}`}>
                  <Ikon nama="berkas" ukuran={24} />
                  <strong>{fileProduk ? 'File produk dipilih' : 'Unggah file konten'}</strong>
                  <span>.zip, .mcaddon, .schem, .jar — maksimal 500 MB</span>
                  <input
                    type="file"
                    accept=".zip,.mcaddon,.schem,.jar"
                    hidden
                    onChange={(e) => pilihBerkas('file', e)}
                  />
                </label>
                {fileProduk && (
                  <span className="berkas-pilih">
                    <Ikon nama="unduh" ukuran={15} />
                    <span>{fileProduk}</span>
                  </span>
                )}
                <p className="bantuan-form">
                  Penyimpanan file aktif setelah backend PHP tersedia.
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
                <span className="v">{namaKategori(form.kategoriId) || '—'}</span>
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
              >
                <Ikon nama="simpan" ukuran={15} />
                Simpan Draft
              </button>
              <button
                type="button"
                className="tombol-admin tombol-hijau"
                onClick={() => simpan('Aktif')}
              >
                <Ikon nama="cek" ukuran={15} />
                Simpan Produk
              </button>
            </div>
            <span className="teks-redup teks-kecil" style={{ textAlign: 'center' }}>
              Data lokal — siap dikirim ke API PHP.
            </span>
          </div>
        </aside>
      </div>
    </>
  )
}
