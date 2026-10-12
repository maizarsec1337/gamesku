import { useMemo, useState } from 'react'
import TabelPesanan from '../komponen/admin/TabelPesanan.jsx'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import Paginasi from '../komponen/admin/Paginasi.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import layananPesanan, { hitungPerStatus, ubahStatusPesanan } from '../layanan/layananPesanan.js'
import { STATUS_PESANAN } from '../data/konstanta.js'
import { formatRupiah } from '../utilitas/format.js'
import '../css/admin-tabel.css'

const PER_HALAMAN = 10

// Kartu ringkasan per status (tanpa angka palsu — dihitung dari data).
const kartuRingkas = [
  { status: 'Menunggu', ikon: 'jam', warna: 'amber' },
  { status: 'Diproses', ikon: 'muatUlang', warna: 'biru' },
  { status: 'Berhasil', ikon: 'centangLingkaran', warna: 'hijau' },
  { status: 'Gagal', ikon: 'silangLingkaran', warna: 'merah' },
]

// =====================================================================
// Halaman kelola pesanan (/admin/pesanan).
//
// Belum ada pesanan sama sekali. Statistik pun 0 — bukan angka contoh.
// =====================================================================
export default function AdminPesanan() {
  const { tampilkanPesan } = useAdmin()
  const daftar = useDaftar(layananPesanan)
  const [filter, setFilter] = useState('')
  const [kata, setKata] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [dipilih, setDipilih] = useState(null)

  const ringkas = hitungPerStatus()

  const hasil = useMemo(() => {
    const kunci = kata.trim().toLowerCase()
    return daftar.filter((p) => {
      const cocokStatus = !filter || p.status === filter
      const cocokKata = !kunci || `${p.id} ${p.pelanggan} ${p.produk}`.toLowerCase().includes(kunci)
      return cocokStatus && cocokKata
    })
  }, [daftar, filter, kata])

  const totalHalaman = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN))
  const halamanAman = Math.min(halaman, totalHalaman)
  const baris = hasil.slice((halamanAman - 1) * PER_HALAMAN, halamanAman * PER_HALAMAN)

  const ubahStatus = (id, status) => {
    const hasilUbah = ubahStatusPesanan(id, status)
    if (hasilUbah.berhasil) {
      tampilkanPesan(`Status pesanan ${id} diubah menjadi ${status}.`)
      setDipilih((p) => (p && p.id === id ? { ...p, status } : p))
    }
  }

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Pesanan</h2>
          <p>
            {daftar.length === 0
              ? 'Belum ada pesanan'
              : 'Kelola seluruh transaksi masuk RAK VIN'}
          </p>
        </div>
      </div>

      <div className="kisi-ringkas">
        {kartuRingkas.map((k) => (
          <article key={k.status} className="kartu-ringkas">
            <span className={`kartu-ringkas-ikon ${k.warna}`}>
              <Ikon nama={k.ikon} ukuran={19} />
            </span>
            <span className="kartu-ringkas-teks">
              <span>{k.status}</span>
              <strong>{ringkas[k.status]}</strong>
            </span>
          </article>
        ))}
      </div>

      {daftar.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="pesanan"
            judul="Belum ada pesanan"
            deskripsi="Pesanan pelanggan akan muncul di sini."
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
                placeholder="Cari no. order, pelanggan…"
                aria-label="Cari pesanan"
              />
            </span>
            <div className="chip-filter">
              {['', ...STATUS_PESANAN].map((f) => (
                <button
                  key={f || 'semua'}
                  type="button"
                  className={`chip ${filter === f ? 'aktif' : ''}`}
                  onClick={() => {
                    setFilter(f)
                    setHalaman(1)
                  }}
                >
                  {f || 'Semua'}
                </button>
              ))}
            </div>
          </div>

          <section className="kartu-panel">
            <TabelPesanan pesanan={baris} padaLihat={setDipilih} />
            <Paginasi
              halaman={halamanAman}
              totalHalaman={totalHalaman}
              ubahHalaman={setHalaman}
              totalBaris={hasil.length}
              perHalaman={PER_HALAMAN}
              label="pesanan"
            />
          </section>
        </>
      )}

      <JendelaModal
        judul={dipilih ? `Detail Pesanan ${dipilih.id}` : 'Detail Pesanan'}
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
              onClick={() => tampilkanPesan(`Nota ${dipilih.id} dikirim ke pelanggan.`)}
            >
              <Ikon nama="unduh" ukuran={15} />
              Kirim Nota
            </button>
          </>
        }
      >
        {dipilih && (
          <>
            <div className="daftar-detail">
              <div className="baris-detail">
                <span className="k">Nomor order</span>
                <span className="v id-pesanan">{dipilih.id}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Tanggal</span>
                <span className="v">{dipilih.tanggal}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Pelanggan</span>
                <span className="v">{dipilih.pelanggan}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Produk</span>
                <span className="v">{dipilih.produk}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Kategori</span>
                <span className="v">{dipilih.kategori}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Metode pembayaran</span>
                <span className="v">{dipilih.metode}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Harga</span>
                <span className="v">
                  {dipilih.total === 0 ? 'Gratis' : formatRupiah(dipilih.total)}
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Status</span>
                <span className="v">
                  <LencanaStatus status={dipilih.status} />
                </span>
              </div>
              <div className="baris-detail">
                <span className="k">Total bayar</span>
                <span className="v" style={{ color: '#7ed965', fontSize: 15 }}>
                  {dipilih.total === 0 ? 'Gratis' : formatRupiah(dipilih.total)}
                </span>
              </div>
            </div>

            <div className="blok-form" style={{ marginTop: 18, marginBottom: 0 }}>
              <label className="label-form" htmlFor="ubah-status">
                Ubah status pesanan
              </label>
              <select
                id="ubah-status"
                className="pilih-admin"
                value={dipilih.status}
                onChange={(e) => ubahStatus(dipilih.id, e.target.value)}
              >
                {STATUS_PESANAN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </JendelaModal>
    </>
  )
}
