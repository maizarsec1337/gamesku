import { useMemo, useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import layananCreator, { tambahCreator } from '../layanan/layananCreator.js'
import { STATUS_CREATOR, waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'

// =====================================================================
// Halaman creator (/admin/creator).
//
// MULAI KOSONG. Tidak ada creator contoh. Creator ditambahkan lewat
// formulir undangan di bawah.
// =====================================================================
export default function AdminCreator() {
  const { tampilkanPesan } = useAdmin()
  const creator = useDaftar(layananCreator)
  const [filter, setFilter] = useState('')
  const [namaBaru, setNamaBaru] = useState('')

  const hasil = useMemo(
    () => (filter ? creator.filter((c) => c.status === filter) : creator),
    [creator, filter],
  )

  const kolom = [
    {
      kunci: 'nama',
      label: 'Creator',
      render: (c) => (
        <span className="sel-produk">
          <span className="avatar-kecil">{(c.nama || '?').charAt(0)}</span>
          <span className="sel-produk-teks">
            <strong>{c.nama}</strong>
            <span>@{c.username || '—'}</span>
          </span>
        </span>
      ),
    },
    {
      kunci: 'bergabung',
      label: 'Bergabung',
      render: (c) => <span className="teks-redup teks-kecil">{waktuRelatif(c.bergabung)}</span>,
    },
    { kunci: 'status', label: 'Status', render: (c) => <LencanaStatus status={c.status} /> },
  ]

  const simpanCreator = (e) => {
    e.preventDefault()
    const hasilTambah = tambahCreator({ nama: namaBaru })
    if (!hasilTambah.berhasil) {
      tampilkanPesan(hasilTambah.pesan)
      return
    }
    tampilkanPesan(`Creator "${hasilTambah.data.nama}" ditambahkan.`)
    setNamaBaru('')
  }

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Creator</h2>
          <p>
            {creator.length === 0
              ? 'Belum ada creator'
              : 'Kreator konten Minecraft yang berjualan di RAK VIN'}
          </p>
        </div>
      </div>

      {creator.length === 0 ? (
        <>
          <section className="kartu-panel">
            <KosongAdmin
              ikon="kreator"
              judul="Belum ada creator."
              deskripsi="Undang kreator pertama untuk mulai menerima produk."
            />
          </section>
          <section className="kartu-panel" style={{ marginTop: 18 }}>
            <div className="panel-kepala">
              <div>
                <h3 className="panel-judul">Undang Creator</h3>
                <p className="panel-sub">Mendaftarkan kreator baru</p>
              </div>
            </div>
            <div className="panel-badan">
              <form onSubmit={simpanCreator}>
                <div className="baris-form">
                  <div className="blok-form">
                    <label className="label-form" htmlFor="creator-nama">
                      Nama Creator <span className="wajib">*</span>
                    </label>
                    <input
                      id="creator-nama"
                      className="isian-admin"
                      value={namaBaru}
                      onChange={(e) => setNamaBaru(e.target.value)}
                      placeholder="Nama kreator"
                    />
                  </div>
                  <div className="blok-form" style={{ alignSelf: 'end' }}>
                    <button type="submit" className="tombol-admin tombol-hijau">
                      <Ikon nama="tambah" ukuran={16} />
                      Undang Creator
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="alat-baris">
            <div className="chip-filter">
              {['', ...STATUS_CREATOR].map((f) => (
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
            <TabelData
              kolom={kolom}
              baris={hasil}
              pesanKosong="Tidak ada creator dengan status ini."
            />
          </section>
        </>
      )}
    </>
  )
}
