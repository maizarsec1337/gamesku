import { useMemo, useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import Paginasi from '../komponen/admin/Paginasi.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import {
  daftarPelangganApi,
  ubahPelangganApi,
  hapusPelangganApi,
  daftarAdminApi,
  ubahAdminApi,
  hapusAdminApi,
} from '../layanan/apiAdmin.js'
import { STATUS_PELANGGAN, waktuRelatif } from '../data/konstanta.js'
import { formatRupiah, formatAngka } from '../utilitas/format.js'
import '../css/admin-tabel.css'

const PER_HALAMAN = 10

export default function SuperadminPengguna() {
  const { tampilkanPesan } = useAdmin()
  const [jenisAkun, setJenisAkun] = useState('pelanggan')
  const [kata, setKata] = useState('')
  const [filter, setFilter] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [dipilih, setDipilih] = useState(null)
  const [dihapus, setDihapus] = useState(null)

  const { data: dataP, memuat: mP, galat: gP, muat: rP } = useApi(() => daftarPelangganApi(), [])
  const { data: dataA, memuat: mA, galat: gA, muat: rA } = useApi(() => daftarAdminApi(), [])
  const memuat = mP || mA
  const galat = gP || gA
  const pelanggan = Array.isArray(dataP) ? dataP : []
  const adminUsers = Array.isArray(dataA) ? dataA : []

  const semua = useMemo(() => {
    const d = []
    for (const p of pelanggan) d.push({ id: p.id, tipe: 'pelanggan', nama: p.nama || '—', username: p.username || '—', email: p.email || '—', peran: 'pembeli', status: p.status, dibuatPada: p.bergabung, jumlahPesanan: p.jumlahPesanan || 0, totalBeli: p.totalBeli || 0 })
    for (const a of adminUsers) d.push({ id: 'admin-' + a.id, tipe: 'admin', nama: a.nama || a.pengguna || '—', username: a.pengguna || '—', email: a.email || '—', peran: a.peran || 'admin', status: a.status, dibuatPada: a.dibuat_pada || '—', jumlahPesanan: 0, totalBeli: 0 })
    return d
  }, [pelanggan, adminUsers])

  const hasil = useMemo(() => {
    const k = kata.trim().toLowerCase()
    return semua.filter((u) => {
      const cKata = !k || `${u.nama} ${u.username} ${u.email} ${u.peran}`.toLowerCase().includes(k)
      const cTipe = !jenisAkun || u.tipe === jenisAkun
      const cSts = !filter || u.status === filter
      return cKata && cTipe && cSts
    })
  }, [semua, kata, filter, jenisAkun])

  const totalHalaman = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN))
  const halamanAman = Math.min(halaman, totalHalaman)
  const baris = hasil.slice((halamanAman - 1) * PER_HALAMAN, halamanAman * PER_HALAMAN)

  const adalahSuperadminTerakhir = (u) => {
    if (u.tipe !== 'admin' || u.peran !== 'superadmin' || u.status !== 'Aktif') return false
    return adminUsers.filter((a) => a.peran === 'superadmin' && a.status === 'Aktif').length <= 1
  }

  const ubahStatus = async (id, tipe, stsBaru) => {
    try {
      if (tipe === 'admin') {
        const aid = id.replace('admin-', '')
        const aLama = adminUsers.find((a) => 'admin-' + a.id === id)
        if (!aLama) throw new Error('Admin tidak ditemukan.')
        if (adalahSuperadminTerakhir(aLama) && stsBaru === 'Nonaktif') { tampilkanPesan('Tidak dapat menonaktifkan superadmin aktif terakhir.'); return }
        await ubahAdminApi(aid, { status: stsBaru, peran: aLama.peran })
      } else {
        const pLama = pelanggan.find((p) => p.id === id)
        await ubahPelangganApi(id, { status: stsBaru, nama: pLama?.nama || '' })
      }
      await rP(); await rA()
      tampilkanPesan('Status ' + tipe + ' diubah menjadi ' + stsBaru + '.')
      setDipilih((p) => (p && p.id === id ? { ...p, status: stsBaru } : p))
    } catch (err) { tampilkanPesan(pesanGalat(err)) }
  }

  const hapusAkun = async () => {
    if (!dihapus) return
    try {
      if (dihapus.tipe === 'admin') {
        const aid = dihapus.id.replace('admin-', '')
        const aLama = adminUsers.find((a) => 'admin-' + a.id === dihapus.id)
        if (!aLama) throw new Error('Admin tidak ditemukan.')
        if (adalahSuperadminTerakhir(aLama)) { tampilkanPesan('Tidak dapat menghapus superadmin aktif terakhir.'); return }
        await hapusAdminApi(aid)
      } else {
        await hapusPelangganApi(dihapus.id)
      }
      await rP(); await rA()
      tampilkanPesan((dihapus.tipe === 'admin' ? 'Admin' : 'Pelanggan') + ' "' + dihapus.nama + '" dihapus.')
    } catch (err) { tampilkanPesan(pesanGalat(err)) }
    setDihapus(null)
  }

  if (memuat) {
    return (<div className="keadaan-kosong keadaan-kosong-admin" role="status"><span className="cb-putar" aria-hidden="true" /><p>Memuat data pengguna…</p></div>)
  }
  if (galat) {
    return (<div className="pesan-salah-login" role="alert"><Ikon nama="info" ukuran={16} />{pesanGalat(galat)}<button type="button" className="tombol-admin tombol-garis" style={{ marginLeft: 'auto' }} onClick={() => { rP(); rA() }}>Coba lagi</button></div>)
  }

  const kolom = [
    { kunci: 'nama', label: 'Nama', render: (u) => (<span className="sel-produk"><span className="avatar-kecil">{u.nama.charAt(0)}</span><span className="sel-produk-teks"><strong>{u.nama}</strong><span>({u.username})</span></span></span>) },
    { kunci: 'email', label: 'Email', render: (u) => <span className="teks-redup">{u.email}</span> },
    { kunci: 'tipe', label: 'Tipe', render: (u) => <span style={{ textTransform: 'capitalize' }}>{u.tipe === 'admin' ? 'Admin Panel' : 'Pelanggan Toko'}</span> },
    { kunci: 'peran', label: 'Peran', render: (u) => <span className="teks-kecil">{u.peran}</span> },
    { kunci: 'status', label: 'Status', render: (u) => <LencanaStatus status={u.status} /> },
    { kunci: 'dibuatPada', label: 'Daftar', render: (u) => <span className="teks-redup teks-kecil">{waktuRelatif(u.dibuatPada)}</span> },
    { kunci: 'aksi', label: 'Aksi', rata: 'sel-kanan', render: (u) => {
      const stsBaru = u.status === 'Aktif' ? 'Nonaktif' : 'Aktif'
      const terakhir = adalahSuperadminTerakhir(u) && u.status === 'Aktif'
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={terakhir ? 'tombol-admin tombol-garis opacity-50 cursor-not-allowed' : 'tombol-admin tombol-garis'} onClick={() => ubahStatus(u.id, u.tipe, stsBaru)} disabled={terakhir} title={terakhir ? 'Superadmin terakhir tidak dapat dinonaktifkan' : undefined}>{u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button>
          {u.tipe === 'admin' && !terakhir && <button type="button" className="tombol-admin tombol-bahaya" onClick={() => setDihapus(u)}><Ikon nama="hapus" ukuran={14} /></button>}
        </div>
      )
    } },
  ]

  return (
    <>
      <div className="judul-halaman"><div><h2>Manajemen Pengguna</h2><p>{hasil.length} akun ditemukan.</p></div></div>
      <div className="alat-baris">
        <div className="chip-filter">
          {['pelanggan', 'admin'].map((t) => (<button key={t} type="button" className={'chip ' + (jenisAkun === t ? 'aktif' : '')} onClick={() => setJenisAkun(t)}>{t === 'pelanggan' ? 'Pelanggan' : 'Admin'}</button>))}
          {STATUS_PELANGGAN.map((f) => (<button key={f} type="button" className={'chip ' + (filter === f ? 'aktif' : '')} onClick={() => setFilter(f)}>{f}</button>))}
        </div>
        <span className="cari-panel"><Ikon nama="cari" ukuran={16} /><input type="search" value={kata} onChange={(e) => setKata(e.target.value)} placeholder="Cari nama, email, username, peran…" aria-label="Cari pengguna" /></span>
      </div>

      {semua.length === 0 ? (
        <section className="kartu-panel"><KosongAdmin ikon="pelanggan" judul="Belum ada pengguna." deskripsi="Pengguna akan muncul setelah ada pendaftaran atau admin baru." /></section>
      ) : (
        <>
          <section className="kartu-panel">
            <TabelData kolom={kolom} baris={baris} pesanKosong="Tidak ada pengguna yang cocok dengan pencarian." />
            <Paginasi halaman={halamanAman} totalHalaman={totalHalaman} ubahHalaman={setHalaman} totalBaris={hasil.length} perHalaman={PER_HALAMAN} label="pengguna" />
          </section>

          <JendelaModal judul={dipilih ? 'Detail: ' + dipilih.nama : 'Detail Pengguna'} padaTutup={dipilih ? () => setDipilih(null) : null} ukuran="lebar">
            {dipilih && (
              <div className="daftar-detail">
                <div className="baris-detail"><span className="k">Nama</span><span className="v">{dipilih.nama}</span></div>
                <div className="baris-detail"><span className="k">Username</span><span className="v">{dipilih.username}</span></div>
                <div className="baris-detail"><span className="k">Email</span><span className="v">{dipilih.email}</span></div>
                <div className="baris-detail"><span className="k">Tipe</span><span className="v">{dipilih.tipe === 'admin' ? 'Admin Panel' : 'Pelanggan Toko'}</span></div>
                <div className="baris-detail"><span className="k">Peran</span><span className="v">{dipilih.peran}</span></div>
                <div className="baris-detail"><span className="k">Status</span><span className="v"><LencanaStatus status={dipilih.status} /></span></div>
                <div className="baris-detail"><span className="k">Daftar</span><span className="v">{waktuRelatif(dipilih.dibuatPada)}</span></div>
                {dipilih.tipe === 'admin' && <div className="baris-detail"><span className="k">Superadmin</span><span className="v">{dipilih.peran === 'superadmin' ? 'Ya' : 'Tidak'}</span></div>}
                {dipilih.tipe === 'pelanggan' && (<><div className="baris-detail"><span className="k">Pesanan</span><span className="v">{formatAngka(dipilih.jumlahPesanan)}</span></div><div className="baris-detail"><span className="k">Total Beli</span><span className="v">{formatRupiah(dipilih.totalBeli)}</span></div></>)}
              </div>
            )}
          </JendelaModal>

          <JendelaModal judul="Hapus Akun?" padaTutup={dihapus ? () => setDihapus(null) : null} ukuran="kecil" kaki={
            <>
              <button type="button" className="tombol-admin tombol-garis" onClick={() => setDihapus(null)}>Batal</button>
              <button type="button" className="tombol-admin tombol-bahaya" onClick={hapusAkun} disabled={dihapus && adalahSuperadminTerakhir(dihapus)}><Ikon nama="hapus" ukuran={15} /> Ya, Hapus</button>
            </>
          }>
            <p style={{ margin: 0, fontSize: 13.8, lineHeight: 1.65 }}>
              Akun <b>{dihapus?.nama}</b> ({dihapus?.tipe}) akan dihapus permanen. Tidak dapat dibatalkan.
              {dihapus?.tipe === 'admin' && adalahSuperadminTerakhir(dihapus) && (<><br /><span style={{ color: '#ef4444', fontSize: 12 }}>Dilarang: superadmin aktif terakhir.</span></>)}
            </p>
          </JendelaModal>
        </>
      )}
    </>
  )
}
