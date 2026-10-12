import { useMemo, useState } from 'react'
import LencanaStatus from '../komponen/admin/LencanaStatus.jsx'
import ThumbnailProduk from '../komponen/admin/ThumbnailProduk.jsx'
import KosongAdmin from '../komponen/admin/KosongAdmin.jsx'
import Ikon from '../komponen/Ikon.jsx'
import { useAdmin } from '../konteks/konteksAdmin.js'
import { useDaftar } from '../layanan/gunakanDaftar.js'
import layananUlasan, { ubahStatusUlasan, rataRating } from '../layanan/layananUlasan.js'
import { STATUS_ULASAN, gradasiOtomatis, waktuRelatif } from '../data/konstanta.js'
import '../css/admin-tabel.css'
import '../css/admin-dasbor.css'

// Deret bintang rating (lucide, bukan emoji).
function Bintang({ nilai }) {
  return (
    <span className="bintang-ulasan" aria-label={`Rating ${nilai} dari 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ikon
          key={n}
          nama="bintang"
          ukuran={14}
          tebal={n <= nilai ? 2.4 : 1.6}
          kelas={n <= nilai ? '' : 'kosong'}
        />
      ))}
    </span>
  )
}

// =====================================================================
// Halaman moderasi ulasan (/admin/ulasan).
//
// MULAI KOSONG. Tidak ada ulasan contoh, tidak ada nama pelanggan
// karangan, dan tidak ada "rata-rata 4,8" yang dipalsukan.
// =====================================================================
export default function AdminUlasan() {
  const { tampilkanPesan } = useAdmin()
  const ulasan = useDaftar(layananUlasan)
  const [filter, setFilter] = useState('')

  const hasil = useMemo(
    () => (filter ? ulasan.filter((u) => u.status === filter) : ulasan),
    [ulasan, filter],
  )

  // Rata-rata hanya ada bila ada ulasan sungguhan.
  const rata = rataRating()

  const ubahStatus = (ulasanItem, status) => {
    const hasilUbah = ubahStatusUlasan(ulasanItem.id, status)
    if (!hasilUbah.berhasil) return
    tampilkanPesan(
      status === STATUS_ULASAN[1]
        ? `Ulasan "${ulasanItem.produk}" disetujui.`
        : `Ulasan "${ulasanItem.produk}" disembunyikan.`,
    )
  }

  return (
    <>
      <div className="judul-halaman">
        <div>
          <h2>Ulasan</h2>
          <p>
            {ulasan.length === 0
              ? 'Belum ada ulasan'
              : 'Moderasi ulasan pelanggan untuk seluruh produk'}
          </p>
        </div>
        <div className="panel-aksi">
          <span className="sambutan-periode">
            <Ikon nama="bintang" ukuran={15} />
            {rata === null
              ? 'Belum ada rating'
              : `Rata-rata ${rata.toFixed(1).replace('.', ',')} / 5`}
          </span>
        </div>
      </div>

      {ulasan.length === 0 ? (
        <section className="kartu-panel">
          <KosongAdmin
            ikon="ulasan"
            judul="Belum ada ulasan."
            deskripsi="Ulasan pelanggan akan muncul di sini setelah ada transaksi."
          />
        </section>
      ) : (
        <>
          <div className="alat-baris">
            <div className="chip-filter">
              {['', ...STATUS_ULASAN].map((f) => (
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
            {hasil.length === 0 ? (
              <KosongAdmin
                ikon="ulasan"
                judul="Belum ada ulasan."
                deskripsi={`Tidak ada ulasan dengan status "${filter}".`}
              />
            ) : (
              <div className="daftar-ulasan">
                {hasil.map((u, i) => (
                  <article
                    key={u.id}
                    className={`baris-ulasan ${u.status === STATUS_ULASAN[2] ? 'ulasan-blokir' : ''}`}
                  >
                    <ThumbnailProduk nama={u.produk} warna={gradasiOtomatis(i)} ukuran={46} />
                    <div className="tubuh-ulasan">
                      <div className="kepala-ulasan">
                        <strong>{u.produk}</strong>
                        <span className="teks-redup">oleh {u.pelanggan}</span>
                        <Bintang nilai={u.rating} />
                        <LencanaStatus status={u.status} />
                      </div>
                      <p className="komentar-ulasan">“{u.komentar}”</p>
                      <div className="kaki-ulasan">
                        <span className="teks-redup teks-kecil">
                          <Ikon nama="kalender" ukuran={12} />
                          {waktuRelatif(u.dibuatPada || u.tanggal)}
                        </span>
                        {u.status !== STATUS_ULASAN[1] && (
                          <button
                            type="button"
                            className="tombol-teks setujui"
                            onClick={() => ubahStatus(u, STATUS_ULASAN[1])}
                          >
                            <Ikon nama="cek" ukuran={14} />
                            Setujui
                          </button>
                        )}
                        {u.status !== STATUS_ULASAN[2] && (
                          <button
                            type="button"
                            className="tombol-teks sembunyi"
                            onClick={() => ubahStatus(u, STATUS_ULASAN[2])}
                          >
                            <Ikon nama="mataTutup" ukuran={14} />
                            Sembunyikan
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
