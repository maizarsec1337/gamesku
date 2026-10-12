import Ikon from '../Ikon.jsx'

// Jendela nomor halaman: maksimal 5 tombol + elipsis.
function jendelaHalaman(halaman, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const mulai = Math.max(1, Math.min(halaman - 2, total - 4))
  const akhir = Math.min(total, mulai + 4)
  const daftar = []
  if (mulai > 1) {
    daftar.push(1)
    if (mulai > 2) daftar.push('...')
  }
  for (let i = mulai; i <= akhir; i += 1) daftar.push(i)
  if (akhir < total) {
    if (akhir < total - 1) daftar.push('...')
    daftar.push(total)
  }
  return daftar
}

// Paginasi tabel admin (UI — koneksi ke API PHP menyusul).
export default function Paginasi({
  halaman,
  totalHalaman,
  ubahHalaman,
  totalBaris,
  perHalaman,
  label = 'baris',
}) {
  if (totalBaris === 0) return null
  const awal = (halaman - 1) * perHalaman + 1
  const akhir = Math.min(halaman * perHalaman, totalBaris)

  return (
    <div className="paginasi">
      <span className="paginasi-info">
        Menampilkan <b>{awal}–{akhir}</b> dari <b>{totalBaris}</b> {label}
      </span>
      <div className="paginasi-tombol">
        <button
          type="button"
          onClick={() => ubahHalaman(halaman - 1)}
          disabled={halaman === 1}
          aria-label="Halaman sebelumnya"
        >
          <Ikon nama="panahKiri" ukuran={15} />
        </button>
        {jendelaHalaman(halaman, totalHalaman).map((n, i) =>
          n === '...' ? (
            <span key={`titik-${i}`} className="titik-putus">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={n === halaman ? 'aktif' : ''}
              onClick={() => ubahHalaman(n)}
              aria-current={n === halaman ? 'page' : undefined}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => ubahHalaman(halaman + 1)}
          disabled={halaman === totalHalaman}
          aria-label="Halaman berikutnya"
        >
          <Ikon nama="panahKanan" ukuran={15} />
        </button>
      </div>
    </div>
  )
}
