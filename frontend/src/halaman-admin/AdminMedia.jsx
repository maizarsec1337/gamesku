import { useMemo, useState } from 'react'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useApi, pesanGalat } from '../layanan/gunakanApi.js'
import { daftarMediaApi, unggahMediaApi, hapusMediaApi } from '../layanan/apiAdmin.js'
import { gradasiOtomatis, waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'

const filterJenis = ['Semua', 'Thumbnail', 'Banner', 'Preview', 'Gambar Produk']

// Ukuran berkas (byte) → teks ringkas.
function ukuranTeks(byte) {
  const n = Number(byte) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Halaman pustaka media (/admin/media) — unggah/hapus ke backend (POST/DELETE /api/media).
export default function AdminMedia() {
  const { tampilkanPesan } = useAdmin()
  const { data, memuat, galat, muat } = useApi(() => daftarMediaApi(), [])
  const daftar = Array.isArray(data) ? data : []
  const [filter, setFilter] = useState('')
  const [dipilih, setDipilih] = useState(null)
  const [dihapus, setDihapus] = useState(null)
  const [bukaUnggah, setBukaUnggah] = useState(false)
  const [mengunggah, setMengunggah] = useState(false)

  const hasil = useMemo(
    () => (!filter || filter === 'Semua' ? daftar : daftar.filter((m) => m.jenis === filter)),
    [daftar, filter],
  )

  const pilihBerkas = async (e) => {
    const berkas = e.target.files?.[0]
    e.target.value = ''
    if (!berkas || mengunggah) return
    setMengunggah(true)
    try {
      await unggahMediaApi(berkas, filter === 'Semua' ? 'Thumbnail' : filter)
      await muat()
      tampilkanPesan(`"${berkas.name}" diunggah.`)
      setBukaUnggah(false)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    } finally {
      setMengunggah(false)
    }
  }

  const konfirmasiHapus = async () => {
    try {
      await hapusMediaApi(dihapus.id)
      await muat()
      tampilkanPesan(`Media "${dihapus.nama}" dihapus.`)
      if (dipilih?.id === dihapus.id) setDipilih(null)
    } catch (err) {
      tampilkanPesan(pesanGalat(err))
    }
    setDihapus(null)
  }

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
        <p>Memuat media…</p>
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
          <h2>Media</h2>
          <p>
            {daftar.length === 0
              ? 'Belum ada media'
              : `${daftar.length} aset gambar: produk, banner, thumbnail, preview`}
          </p>
        </div>
        <div className="panel-aksi">
          <button
            type="button"
            className="tombol-admin tombol-hijau"
            onClick={() => setBukaUnggah(true)}
          >
            <Ikon nama="unggah" ukuran={16} />
            Unggah Media
          </button>
        </div>
      </div>

      {daftar.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="media"
            judul="Belum ada media."
            deskripsi="Unggah gambar pertama untuk mulai mengisi pustaka media."
            aksi={{ label: 'Unggah Media', ikon: 'unggah', onKlik: () => setBukaUnggah(true) }}
          />
        </section>
      ) : (
        <>
          <div className="alat-baris">
            <div className="chip-filter">
              {filterJenis.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${filter === f ? 'aktif' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {hasil.length === 0 ? (
            <section className="kartu-panel">
              <KosongAdmin
                ikon="media"
                judul="Belum ada media."
                deskripsi={`Belum ada berkas berjenis ${filter}.`}
                aksi={{
                  label: 'Unggah Media',
                  ikon: 'unggah',
                  onKlik: () => setBukaUnggah(true),
                }}
              />
            </section>
          ) : (
            <div className="kisi-media">
              <button
                type="button"
                className="tombol-tambah-kategori"
                style={{ minHeight: 200 }}
                onClick={() => setBukaUnggah(true)}
              >
                <Ikon nama="unggah" ukuran={24} />
                <span>Unggah Media</span>
              </button>

              {hasil.map((m, i) => (
                <article
                  key={m.id}
                  className="kartu-media"
                  onClick={() => setDipilih(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setDipilih(m)
                  }}
                >
                  <div
                    className="pratinjau-media"
                    style={{ background: `linear-gradient(135deg, ${gradasiOtomatis(i).join(', ')})` }}
                  >
                    {m.url ? (
                      <img src={m.url} alt={m.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Ikon nama="gambar" ukuran={34} />
                    )}
                    <div className="overlay-media">
                      <button
                        type="button"
                        className="tombol-media"
                        aria-label="Pratinjau"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDipilih(m)
                        }}
                      >
                        <Ikon nama="lihat" ukuran={16} />
                      </button>
                      <button
                        type="button"
                        className="tombol-media bahaya"
                        aria-label="Hapus"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDihapus(m)
                        }}
                      >
                        <Ikon nama="hapus" ukuran={16} />
                      </button>
                    </div>
                  </div>
                  <div className="media-info">
                    <strong>{m.nama}</strong>
                    <span>
                      {m.jenis} · {ukuranTeks(m.ukuran)} · {waktuRelatif(m.tanggal)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <JendelaModal
        judul="Unggah Media Baru"
        padaTutup={bukaUnggah ? () => setBukaUnggah(false) : null}
        ukuran="kecil"
        kaki={
          <button
            type="button"
            className="tombol-admin tombol-garis"
            onClick={() => setBukaUnggah(false)}
          >
            Batal
          </button>
        }
      >
        <label className="area-unggah terisi">
          <Ikon nama="unggah" ukuran={26} />
          <strong>{mengunggah ? 'Mengunggah…' : 'Pilih berkas gambar'}</strong>
          <span>PNG, JPG, WEBP, GIF, atau PDF — maksimal 8 MB</span>
          <input type="file" accept="image/*,application/pdf,application/zip" hidden onChange={pilihBerkas} disabled={mengunggah} />
        </label>
        <p className="bantuan-form">
          Berkas diunggah ke server (folder uploads/) dan tercatat di pustaka media.
        </p>
      </JendelaModal>

      <JendelaModal
        judul="Pratinjau Media"
        padaTutup={dipilih ? () => setDipilih(null) : null}
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
              className="tombol-admin tombol-bahaya"
              onClick={() => setDihapus(dipilih)}
            >
              <Ikon nama="hapus" ukuran={15} />
              Hapus
            </button>
          </>
        }
      >
        {dipilih && (
          <>
            <div
              className="pratinjau-media"
              style={{ borderRadius: 13, marginBottom: 16 }}
            >
              {dipilih.url ? (
                <img src={dipilih.url} alt={dipilih.nama} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Ikon nama="gambar" ukuran={46} />
              )}
            </div>
            <div className="daftar-detail" style={{ gridTemplateColumns: '1fr' }}>
              <div className="baris-detail">
                <span className="k">Nama berkas</span>
                <span className="v">{dipilih.nama}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Jenis</span>
                <span className="v">{dipilih.jenis}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Ukuran</span>
                <span className="v">{ukuranTeks(dipilih.ukuran)}</span>
              </div>
              <div className="baris-detail">
                <span className="k">URL</span>
                <span className="v">{dipilih.url || '—'}</span>
              </div>
            </div>
          </>
        )}
      </JendelaModal>

      <JendelaModal
        judul="Hapus Media?"
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
          Media <b>{dihapus?.nama}</b> akan dihapus dari pustaka.
        </p>
      </JendelaModal>
    </>
  )
}
