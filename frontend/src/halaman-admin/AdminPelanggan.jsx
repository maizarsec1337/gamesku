import { useMemo, useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { daftarPelangganApi } from '../layanan/apiAdmin.js'
import { STATUS_PELANGGAN, waktuRelatif } from '../data/konstanta.js'
import { formatRupiah, formatAngka } from '../utilitas/format.js'
import '../css/admin-tabel.css'

// Halaman pelanggan (/admin/pelanggan) — data dari backend (GET /api/pelanggan).
export default function AdminPelanggan() {
  const { data, memuat, galat, muat } = useApi(() => daftarPelangganApi(), [])
  const pelanggan = Array.isArray(data) ? data : []
  const [kata, setKata] = useState('')
  const [filter, setFilter] = useState('')

  const hasil = useMemo(() => {
    const k = kata.trim().toLowerCase()
    const dasar = !k
      ? pelanggan
      : pelanggan.filter((p) => `${p.nama} ${p.username} ${p.email}`.toLowerCase().includes(k))
    return filter ? dasar.filter((p) => p.status === filter) : dasar
  }, [pelanggan, kata, filter])

  const kolom = [
    {
      kunci: 'nama',
      label: 'Nama',
      render: (p) => (
        <span className="sel-produk">
          <span className="avatar-kecil">{(p.nama || '?').charAt(0)}</span>
          <span className="sel-produk-teks">
            <strong>{p.nama || '—'}</strong>
          </span>
        </span>
      ),
    },
    {
      kunci: 'username',
      label: 'Username',
      render: (p) => <span className="teks-redup">@{p.username || '—'}</span>,
    },
    {
      kunci: 'email',
      label: 'Email',
      render: (p) => <span className="teks-redup">{p.email}</span>,
    },
    {
      kunci: 'totalBeli',
      label: 'Total Pembelian',
      rata: 'sel-kanan',
      render: (p) => <span className="nominal">{formatRupiah(p.totalBeli)}</span>,
    },
    {
      kunci: 'jumlahPesanan',
      label: 'Jumlah Pesanan',
      rata: 'sel-kanan',
      render: (p) => <span className="nominal teks-redup">{formatAngka(p.jumlahPesanan)}</span>,
    },
    {
      kunci: 'bergabung',
      label: 'Bergabung',
      render: (p) => <span className="teks-redup teks-kecil">{waktuRelatif(p.bergabung)}</span>,
    },
    { kunci: 'status', label: 'Status', render: (p) => <LencanaStatus status={p.status} /> },
  ]

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat pelanggan…</p>
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
          <h2>Pelanggan</h2>
          <p>
            {pelanggan.length === 0
              ? 'Belum ada pelanggan'
              : `${pelanggan.length} akun terdaftar di Gamesku`}
          </p>
        </div>
      </div>

      {pelanggan.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="pelanggan"
            judul="Belum ada pelanggan."
            deskripsi="Pelanggan akan muncul setelah ada pendaftaran di toko."
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
                onChange={(e) => setKata(e.target.value)}
                placeholder="Cari nama, username, email…"
                aria-label="Cari pelanggan"
              />
            </span>
            <div className="chip-filter">
              {['', ...STATUS_PELANGGAN].map((f) => (
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
              pesanKosong="Tidak ada pelanggan yang cocok dengan pencarian."
            />
          </section>
        </>
      )}
    </>
  )
}
