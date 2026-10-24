import { useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { daftarAktivitasApi } from '../layanan/apiAdmin.js'
import { waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'

// Audit log superadmin — lihat jejak aktivitas administratif dari backend.
// Tidak mencatat sandi, token, atau rahasia lain.
export default function SuperadminAudit() {
  const { tampilkanPesan } = useAdmin()
  const [batas, setBatas] = useState(50)

  const { data, memuat, galat, muat } = useApi(() => daftarAktivitasApi(batas), [batas])
  const aktivitas = Array.isArray(data) ? data : []

  if (memuat) {
    return (<div className="keadaan-kosong keadaan-kosong-admin" role="status"><span className="cb-putar" aria-hidden="true" /><p>Memuat jejak aktivitas…</p></div>)
  }
  if (galat) {
    return (<div className="pesan-salah-login" role="alert"><Ikon nama="info" ukuran={16} />{pesanGalat(galat)}<button type="button" className="tombol-admin tombol-garis" style={{ marginLeft: 'auto' }} onClick={muat}>Coba lagi</button></div>)
  }

  const kolom = [
    { kunci: 'waktu', label: 'Waktu', render: (a) => <span className="teks-kecil teks-redup">{waktuRelatif(a.waktu)}</span> },
    { kunci: 'pengguna', label: 'Aktor', render: (a) => <span className="teks-redup">{a.pengguna || 'sistem'}</span> },
    { kunci: 'jenis', label: 'Tindakan', render: (a) => <span className="teks-kecil">{a.jenis_aktivitas || a.teks}</span> },
    { kunci: 'target', label: 'Target', render: (a) => <span className="teks-redup">{a.target_table || '-'}</span> },
    { kunci: 'id', label: 'Target ID', render: (a) => <span className="teks-redup teks-kecil">{a.target_id || '-'}</span> },
    { kunci: 'hasil', label: 'Hasil', render: (a) => <span className={`status-${String(a.hasil).toLowerCase()}`}>{a.hasil}</span> },
    { kunci: 'teks', label: 'Keterangan', render: (a) => <span className="teks-redup">{a.teks}</span> },
  ]

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Audit Log</h2>
          <p>Jejak aktivitas administratif (aktor, tindakan, waktu, hasil).</p>
        </div>
      </div>

      <div className="alat-baris">
        <span className="chip-filter">
          {['50', '100', '200'].map((b) => (
            <button key={b} type="button" className={'chip ' + (batas == b ? 'aktif' : '')} onClick={() => setBatas(Number(b))}>{b} entri</button>
          ))}
        </span>
      </div>

      {aktivitas.length === 0 ? (
        <section className="kartu-panel"><KosongAdmin ikon="centangLingkaran" judul="Belum ada jejak aktivitas." deskripsi="Aktivitas admin akan muncul di sini." /></section>
      ) : (
        <section className="kartu-panel">
          <TabelData kolom={kolom} baris={aktivitas} pesanKosong="Tidak ada jejak aktivitas." />
        </section>
      )}
    </>
  )
}
