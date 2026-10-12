import { useMemo, useState } from 'react'
import JendelaModal from '../komponen/admin/JendelaModal.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import layananMedia, { tambahMedia, hapusMedia } from '../layanan/layananMedia.js'
import { gradasiOtomatis, waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'

const filterJenis = ['Semua', 'Thumbnail', 'Banner', 'Preview', 'Gambar Produk']

// =====================================================================
// Halaman pustaka media (/admin/media).
//
// MULAI KOSONG. Tidak ada gambar contoh. Media masuk setelah admin
// mengunggah berkas sungguhan.
// =====================================================================
export default function AdminMedia() {
  const { tampilkanPesan } = useAdmin()
  const daftar = useDaftar(layananMedia)
  const [filter, setFilter] = useState('')
  const [dipilih, setDipilih] = useState(null)
  const [dihapus, setDihapus] = useState(null)
  const [bukaUnggah, setBukaUnggah] = useState(false)

  const hasil = useMemo(
    () => (!filter || filter === 'Semua' ? daftar : daftar.filter((m) => m.jenis === filter)),
    [daftar, filter],
  )

  const pilihBerkas = (e) => {
    const berkas = e.target.files?.[0]
    if (!berkas) return
    const hasilUnggah = tambahMedia(berkas, filter === 'Semua' ? 'Thumbnail' : filter)
    if (hasilUnggah.berhasil) tampilkanPesan(`"${berkas.name}" diunggah.`)
    setBukaUnggah(false)
    e.target.value = ''
  }

  const konfirmasiHapus = () => {
    const hasilHapus = hapusMedia(dihapus.id)
    if (hasilHapus.berhasil) tampilkanPesan(`Media "${dihapus.nama}" dihapus.`)
    if (dipilih?.id === dihapus.id) setDipilih(null)
    setDihapus(null)
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

          <button
            type="button"
            className="tombol-tambah-kategori"
            style={{ minHeight: 200 }}
            onClick={() => setBukaUnggah(true)}
          >
            <Ikon nama="unggah" ukuran={24} />
            <span>Unggah Media</span>
          </button>

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
                    <Ikon nama="gambar" ukuran={34} />
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
                      {m.jenis} · {m.ukuran} · {waktuRelatif(m.dibuatPada || m.tanggal)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal unggah */}
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
          <strong>Pilih berkas gambar</strong>
          <span>PNG, JPG, atau WEBP — maksimal 2 MB</span>
          <input type="file" accept="image/*" hidden onChange={pilihBerkas} />
        </label>
        <p className="bantuan-form">
          Berkas disimpan sementara di memori browser. Nanti diganti penyimpanan
          server PHP.
        </p>
      </JendelaModal>

      {/* Modal pratinjau */}
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
              style={{
                background: `linear-gradient(135deg, ${gradasiOtomatis(0).join(', ')})`,
                borderRadius: 13,
                marginBottom: 16,
              }}
            >
              <Ikon nama="gambar" ukuran={46} />
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
                <span className="v">{dipilih.ukuran}</span>
              </div>
              <div className="baris-detail">
                <span className="k">Diunggah</span>
                <span className="v">{dipilih.tanggal}</span>
              </div>
            </div>
          </>
        )}
      </JendelaModal>

      {/* Modal hapus */}
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