import Ikon from '../Ikon.jsx'

// Grafik mini (sparkline) di kartu statistik.
// Hanya dirender bila ada deret angka NYATA. Tanpa data, kartu tetap
// tampil bersih — tidak ada garis lurus palsu.
function Sparkline({ data, hijau = true }) {
  if (!data || data.length < 2) return null
  const maks = Math.max(...data)
  const min = Math.min(...data)
  const lebar = 96
  const tinggi = 36
  const rentang = maks - min || 1
  const titik = data
    .map((n, i) => {
      const x = (i / (data.length - 1)) * lebar
      const y = tinggi - ((n - min) / rentang) * (tinggi - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const warna = hijau ? '#43DDF5' : '#BD54F5'

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${lebar} ${tinggi}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={titik}
        fill="none"
        stroke={warna}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Kartu statistik: ikon, nilai, keterangan, dan sparkline opsional.
//
// Properti "perubahan" (persen) sengaja opsional. Saat belum ada periode
// pembanding, kartu tidak memalsukan angka "±0%".
export default function KartuStatistik({
  judul,
  nilai,
  perubahan,
  naik = true,
  ket,
  ikon,
  warna = 'hijau',
  grafik,
}) {
  return (
    <article className="kartu-statistik">
      <div className="kartu-statistik-kepala">
        <span className={`kartu-statistik-ikon ${warna}`}>
          <Ikon nama={ikon} ukuran={21} />
        </span>
        {perubahan && (
          <span className={`perubahan ${naik ? 'naik' : 'turun'}`}>
            <Ikon nama={naik ? 'trenNaik' : 'trenTurun'} ukuran={13} />
            {perubahan}
          </span>
        )}
      </div>
      <p className="kartu-statistik-judul">{judul}</p>
      <p className="kartu-statistik-nilai">{nilai}</p>
      <div className="kartu-statistik-bawah">
        <span className="kartu-statistik-ket">{ket}</span>
        <Sparkline data={grafik} hijau={warna !== 'coklat'} />
      </div>
    </article>
  )
}
