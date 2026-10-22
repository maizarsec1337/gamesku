import { useMemo, useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import TombolAksi from '../komponen/admin/TombolAksi.jsx'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import {
  daftarPromoApi,
  buatPromoApi,
  ubahPromoApi,
  hapusPromoApi,
} from '../layanan/apiAdmin.js'
import { STATUS_PROMO } from '../data/konstanta.js'
import '../css/admin-tabel.css'

const formKosong = () => ({ kode: '', nama: '', diskon: 10, mulai: '', berakhir: '', batas: 100 })

// =====================================================================
// Halaman promo (/admin/promo).
//
// MULAI KOSONG. Tidak ada promo contoh. Status promo dihitung dari
// tanggal mulai/berakhir, bukan diketik bebas.
// =====================================================================
export default function AdminPromo() {
  const { tampilkanPesan } = useAdmin()
  const { data, memuat, galat, muat } = useApi(() => daftarPromoApi(), [])
  const promo = Array.isArray(data) ? data : []
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState(formKosong)
  const [mode, setMode] = useState(null) // 'baru' | id promo | null
  const [dihapus, setDihapus] = useState(null)
  const [menyimpan, setMenyimpan] = useState(false)

  const hasil = useMemo(
    () => (filter ? promo.filter((p) => p.status === filter) : promo),
    [promo, filter],
  )

  const bukaTambah = () => {
    setForm(formKosong())
    setMode('baru')
  }

  const bukaEdit = (p) => {
    setForm({
      kode: p.kode,
      nama: p.nama,
      diskon: p.diskon,
      mulai: p.mulai,
      berakhir: p.berakhir,
      batas: p.batas,
    })
    setMode(p.id)
  }

  const simpan = async (e) => {
    e.preventDefault()
    if (menyimpan) return
    setMenyimpan(true)
    try {
      const hasil = mode === 'baru' ? await buatPromoApi(form) : await ubahPromoApi(mode, form)
      await muat()
      tampilkanPesan(`Promo "${hasil?.nama || form.nama}" disimpan.`)
      setMode(null)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    } finally {
      setMenyimpan(false)
    }
  }

  const konfirmasiHapus = async () => {
    try {
      await hapusPromoApi(dihapus.id)
      await muat()
      tampilkanPesan(`Promo ${dihapus.kode} dihapus.`)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    }
    setDihapus(null)
  }

  const kolom = [
    { kunci: 'kode', label: 'Kode Promo', render: (p) => <span className="kode-promo">{p.kode}</span> },
    { kunci: 'nama', label: 'Nama Promo' },
    { kunci: 'diskon', label: 'Diskon', rata: 'sel-kanan', render: (p) => <span className="nominal">{p.diskon}%</span> },
    { kunci: 'mulai', label: 'Mulai', render: (p) => <span className="teks-redup teks-kecil">{p.mulai || '—'}</span> },
    { kunci: 'berakhir', label: 'Berakhir', render: (p) => <span className="teks-redup teks-kecil">{p.berakhir || '—'}</span> },
    { kunci: 'terpakai', label: 'Penggunaan', render: (p) => {
        const persen = Math.min(100, Math.round((p.terpakai / p.batas) * 100))
        return (
          <span className={`kemajuan ${persen >= 100 ? 'penuh' : ''}`}>
            <span className="kemajuan-atas">
              <span>{p.terpakai}/{p.batas}</span>
              <span>{persen}%</span>
            </span>
            <span className="kemajuan-jalur">
              <span className="kemajuan-isian" style={{ width: `${persen}%` }} />
            </span>
          </span>
        )
      } },
    { kunci: 'status', label: 'Status', render: (p) => <LencanaStatus status={p.status} /> },
    {
      kunci: 'aksi',
      label: 'Aksi',
      rata: 'sel-kanan',
      render: (p) => (
        <span className="baris-aksi">
          <TombolAksi ikon="edit" label="Edit" jenis="utama" padaKlik={() => bukaEdit(p)} />
          <TombolAksi ikon="hapus" label="Hapus" jenis="bahaya" padaKlik={() => setDihapus(p)} />
        </span>
      ),
    },
  ]

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat promo…</p>
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
          <h2>Promo</h2>
          <p>
            {promo.length === 0
              ? 'Belum ada promo'
              : 'Kode diskon & kampanye Gamesku'}
          </p>
        </div>
        <div className="panel-aksi">
          <button type="button" className="tombol-admin tombol-hijau" onClick={bukaTambah}>
            <Ikon nama="tambah" ukuran={16} />
            Buat Promo
          </button>
        </div>
      </div>

      {promo.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="promo"
            judul="Belum ada promo."
            deskripsi="Buat kode promo pertama untuk mengaktifkan diskon di toko."
            aksi={{ label: '+ Tambah Promo', onKlik: bukaTambah }}
          />
        </section>
      ) : (
        <>
          <div className="alat-baris">
            <div className="chip-filter">
              {['', ...STATUS_PROMO].map((f) => (
                <button
                  key={f || 'semua'}
                  type="button"
                  className={`chip ${filter === f ? 'aktif' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f || 'Semua'}
                </button>
              ))}
            </div>
          </div>

          <section className="kartu-panel">
            <TabelData kolom={kolom} baris={hasil} pesanKosong="Tidak ada promo dengan status ini." />
          </section>
        </>
      )}

      <JendelaModal
        judul={mode === 'baru' ? 'Buat Promo Baru' : 'Edit Promo'}
        padaTutup={mode ? () => setMode(null) : null}
        kaki={
          <>
            <button
              type="button"
              className="tombol-admin tombol-garis"
              onClick={() => setMode(null)}
            >
              Batal
            </button>
            <button type="submit" form="form-promo" className="tombol-admin tombol-hijau" disabled={menyimpan}>
              <Ikon nama="simpan" ukuran={15} />
              {menyimpan ? 'Menyimpan…' : 'Simpan Promo'}
            </button>
          </>
        }
      >
        <form id="form-promo" onSubmit={simpan}>
          <div className="baris-form">
            <div className="blok-form">
              <label className="label-form" htmlFor="promo-kode">
                Kode promo <span className="wajib">*</span>
              </label>
              <input
                id="promo-kode"
                className="isian-admin"
                value={form.kode}
                onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value }))}
                placeholder="HEMAT25"
                style={{ textTransform: 'uppercase' }}
                autoFocus
              />
            </div>
            <div className="blok-form">
              <label className="label-form" htmlFor="promo-nama">
                Nama promo <span className="wajib">*</span>
              </label>
              <input
                id="promo-nama"
                className="isian-admin"
                value={form.nama}
                onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                placeholder="Promo Akhir Tahun"
              />
            </div>
          </div>
          <div className="baris-form tiga">
            <div className="blok-form">
              <label className="label-form" htmlFor="promo-diskon">Diskon (%)</label>
              <input
                id="promo-diskon"
                type="number"
                min="0"
                max="100"
                className="isian-admin"
                value={form.diskon}
                onChange={(e) => setForm((f) => ({ ...f, diskon: e.target.value }))}
              />
            </div>
            <div className="blok-form">
              <label className="label-form" htmlFor="promo-mulai">Tanggal mulai</label>
              <input
                id="promo-mulai"
                type="date"
                className="isian-admin"
                value={form.mulai}
                onChange={(e) => setForm((f) => ({ ...f, mulai: e.target.value }))}
              />
            </div>
            <div className="blok-form">
              <label className="label-form" htmlFor="promo-akhir">Berakhir</label>
              <input
                id="promo-akhir"
                type="date"
                className="isian-admin"
                value={form.berakhir}
                onChange={(e) => setForm((f) => ({ ...f, berakhir: e.target.value }))}
              />
            </div>
          </div>
          <div className="blok-form" style={{ marginBottom: 0 }}>
            <label className="label-form" htmlFor="promo-batas">Batas penggunaan</label>
            <input
              id="promo-batas"
              type="number"
              min="1"
              className="isian-admin"
              value={form.batas}
              onChange={(e) => setForm((f) => ({ ...f, batas: e.target.value }))}
            />
            <p className="bantuan-form">
              Promo baru tersimpan berstatus “Terjadwal” hingga tanggal mulai.
            </p>
          </div>
        </form>
      </JendelaModal>

      <JendelaModal
        judul="Hapus Promo?"
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
          Promo <b>{dihapus?.kode}</b> akan dihapus permanen.
        </p>
      </JendelaModal>
    </>
  )
}
