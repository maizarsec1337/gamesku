import { useMemo, useState } from 'react'
import TabelData from '../komponen/admin/TabelData.jsx'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import TombolAksi from '../komponen/admin/TombolAksi.jsx'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { daftarResellerApi, ubahStatusResellerApi } from '../layanan/apiAdmin.js'
import { waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'

const LABEL_STATUS = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Gagal' }
const FILTER = [{ nilai: '', label: 'Semua' }, { nilai: 'pending', label: 'Menunggu' }, { nilai: 'approved', label: 'Disetujui' }, { nilai: 'rejected', label: 'Ditolak' }]

// Halaman reseller admin (/admin/reseller). Data + otorisasi dari backend
// (GET /api/reseller, superadmin). IDOR & role dicek server; frontend hanya
// mempresentasikan. Tidak ada data contoh.
export default function AdminReseller() {
  const { tampilkanPesan } = useAdmin()
  const [halaman, setHalaman] = useState(1)
  const [cari, setCari] = useState('')
  const [filter, setFilter] = useState('')
  const [terpilih, setTerpilih] = useState(null)     // untuk modal detail
  const [konfirmasi, setKonfirmasi] = useState(null) // {id, status, alasan?}
  const [menyimpan, setMenyimpan] = useState(false)

  const { data, memuat, galat, muat } = useApi(
    () => daftarResellerApi({ halaman, cari, status: filter }),
    [halaman, cari, filter],
  )

  const baris = Array.isArray(data?.data) ? data.data : []
  const jumlah = Number(data?.jumlah ?? 0)
  const batas = Number(data?.batas ?? 20)
  const totalHalaman = batas > 0 ? Math.max(1, Math.ceil(jumlah / batas)) : 1

  // Ringkasan berdasarkan status (dari data halaman ini; backend juga dapat
  // disaring per status — untuk ringkasan akurat fetch sekali per status).
  const ringkasan = useMemo(() => {
    const hitung = (s) => baris.filter((b) => b.status === s).length
    return { pending: hitung('pending'), approved: hitung('approved'), rejected: hitung('rejected') }
  }, [baris])

  const kolom = [
    {
      kunci: 'nama', label: 'Nama', rata: 'sel-kiri',
      render: (b) => (
        <span className="sel-produk">
          <span className="avatar-kecil">{(b.nama || '?').charAt(0)}</span>
          <span className="sel-produk-teks"><strong>{b.nama || '—'}</strong></span>
        </span>
      ),
    },
    { kunci: 'email', label: 'Email', render: (b) => <span className="teks-redup">{b.email}</span> },
    { kunci: 'username', label: 'Username', render: (b) => <span className="teks-redup">@{b.username || '—'}</span> },
    { kunci: 'whatsapp', label: 'WhatsApp', render: (b) => <span className="teks-redup">{b.whatsapp || '—'}</span> },
    { kunci: 'status', label: 'Status', render: (b) => <LencanaStatus status={LABEL_STATUS[b.status] || '—'} /> },
    { kunci: 'dibuat_pada', label: 'Diajukan', render: (b) => <span className="teks-redup teks-kecil">{waktuRelatif(b.dibuat_pada)}</span> },
    {
      kunci: 'aksi', label: 'Aksi', rata: 'sel-kanan',
      render: (b) => (
        <span className="baris-aksi">
          {(b.status === 'pending') && (
            <>
              <TombolAksi ikon="centangLingkaran" label="Setujui" jenis="utama"
                padaKlik={() => setKonfirmasi({ id: b.id, status: 'approved' })} />
              <TombolAksi ikon="silangLingkaron" label="Tolak" jenis="bahaya"
                padaKlik={() => setKonfirmasi({ id: b.id, status: 'rejected' })} />
            </>
          )}
          <TombolAksi ikon="lihat" label="Lihat" jenis="netral"
                padaKlik={() => setTerpilih(b)} />
        </span>
      ),
    },
  ]

  // ... (loading/error/empty/render) diteruskan ke bawah.

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Reseller</h2>
          <p>Permohonan &amp; pengelolaan reseller GameKU.</p>
        </div>
        <div className="panel-aksi">
          <input type="search" className="isian-admin" placeholder="Cari nama, email, username…"
            value={cari} onChange={(e) => { setCari(e.target.value); setHalaman(1); }}
            style={{ maxWidth: 260 }} />
          <button type="button" className="tombol-admin tombol-garis" onClick={muat}>
            <Ikon nama="muatUlang" ukuran={15} /> Muat Ulang
          </button>
        </div>
      </div>

      {/* Ringkasan cepat (dari data halaman saat ini). */}
      <div className="kisi-produk" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[{ nilai: ringkasan.pending, label: 'Menunggu', ikon: 'jam' },
          { nilai: ringkasan.approved, label: 'Disetujui', ikon: 'centangLingkaran' },
          { nilai: ringkasan.rejected, label: 'Ditolak', ikon: 'silangLingkaron' }].map((s) => (
          <article key={s.label} className="kartu"><div className="kartu-isi" style={{ textAlign: 'center' }}>
            <Ikon nama={s.ikon} ukuran={18} />
            <strong style={{ fontSize: 20 }}>{s.nilai}</strong>
            <p className="subjudul-halaman" style={{ margin: 0 }}>{s.label}</p>
          </div></article>
        ))}
      </div>

      <KosongAdmin
        ikon="dompet"
        judul={jumlah === 0 && !memuat ? 'Belum ada pengajuan reseller.' : null}
        deskripsi={jumlah === 0 && !memuat ? 'Permohonan reseller akan muncul di sini.' : null}
      />

      {memuat && (
        <div className="keadaan-kosong keadaan-kosong-admin" role="status">
          <span className="cb-putar" aria-hidden="true" />
          <p>Memuat pengajuan reseller…</p>
        </div>
      )}

      {galat && (
        <div className="pesan-salah-login" role="alert">
          <Ikon nama="info" ukuran={16} /> {pesanGalat(galat)}
        </div>
      )}

      {!memuat && !galat && baris.length > 0 && (
        <section className="kartu-panel">
          <TabelData kolom={kolom} baris={baris} />
          <div className="alat-baris" style={{ justifyContent: 'space-between' }}>
            <div className="teks-redup teks-kecil">
              {jumlah} pengajuan · halaman {halaman}/{totalHalaman}
            </div>
            <div className="chip-filter">
              {FILTER.map((f) => (
                <button key={f.nilai || 'semua'} type="button"
                  className={`chip ${filter === f.nilai ? 'aktif' : ''}`}
                  onClick={() => { setFilter(f.nilai); setHalaman(1); }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="tombol-admin tombol-garis"
                onClick={() => setHalaman((h) => Math.max(1, h - 1))} disabled={halaman <= 1}>
                <Ikon nama="panahKiri" ukuran={14} />
              </button>
              <button type="button" className="tombol-admin tombol-garis"
                onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))} disabled={halaman >= totalHalaman}>
                <Ikon nama="panahKanan" ukuran={14} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Modal: detail pengajuan */}
      <JendelaModal judul="Detail Pengajuan Reseller"
        padaTutup={terpilih ? () => setTerpilih(null) : null}>
          {terpilih ? (
            <div className="baris-form">
            <div className="blok-form"><span className="teks-redup">Nama</span><strong>{terpilih.nama}</strong></div>
            <div className="blok-form"><span className="teks-redup">Email</span><strong>{terpilih.email}</strong></div>
            <div className="blok-form"><span className="teks-redup">Username</span><strong>@{terpilih.username}</strong></div>
            <div className="blok-form"><span className="teks-redup">WhatsApp</span><strong>{terpilih.whatsapp}</strong></div>
            <div className="blok-form"><span className="teks-redup">Status</span><LencanaStatus status={LABEL_STATUS[terpilih.status] || '—'} /></div>
            <div className="blok-form"><span className="teks-redup">Diajukan</span><strong>{waktuRelatif(terpilih.dibuat_pada)}</strong></div>
            {terpilih.alasan_penolakan ? (
              <div className="blok-form"><span className="teks-redup">Alasan Penolakan</span><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{terpilih.alasan_penolakan}</pre></div>
            ) : null}
            {terpilih.catatan ? (
              <div className="blok-form"><span className="teks-redup">Catatan Pembeli</span><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{terpilih.catatan}</pre></div>
            ) : null}
          </div>
          ) : null}
      </JendelaModal>

      {/* Modal: setujui / tolak */}
      {konfirmasi && (
        <JendelaModal
          judul={konfirmasi.status === 'approved' ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?'}
          padaTutup={() => setKonfirmasi(null)}
          ukuran="kecil"
          kaki={
            <>
              <button type="button" className="tombol-admin tombol-garis"
                onClick={() => setKonfirmasi(null)} disabled={menyimpan}>Batal</button>
              <button type="button" className="tombol-admin tombol-bahaya"
                disabled={menyimpan || (konfirmasi.status === 'rejected' && !konfirmasi.alasan_penolakan)}
                onClick={async () => {
                  if (menyimpan) return
                  setMenyimpan(true)
                  try {
                    await ubahStatusResellerApi(konfirmasi.id, {
                      status: konfirmasi.status,
                      alasan_penolakan: konfirmasi.alasan_penolakan || '',
                    })
                    await muat()
                    tampilkanPesan(konfirmasi.status === 'approved' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.')
                    setKonfirmasi(null)
                  } catch (err) {
                    tampilkanPesan(pesanGalat(err))
                  } finally {
                    setMenyimpan(false)
                  }
                }}>
                {menyimpan ? <><Ikon nama="jam" ukuran={14} /> Memproses…</> : (konfirmasi.status === 'approved' ? 'Setujui' : 'Tolak')}
              </button>
            </>
          }>
          <div className="blok-form">
            <label className="label-form" htmlFor="alasan-penolakan">
              Alasan {konfirmasi.status === 'rejected' ? 'penolakan (wajib)' : ''}
            </label>
            <textarea id="alasan-penolakan" className="isian-admin" rows={3}
              placeholder={konfirmasi.status === 'rejected' ? 'Masukkan alasan penolakan' : 'Opsional'}
              value={konfirmasi.alasan_penolakan || ''}
              maxLength={500}
              onChange={(e) => setKonfirmasi((c) => ({ ...c, alasan_penolakan: e.target.value }))} />
          </div>
        </JendelaModal>
      )}
    </>
  )
}
