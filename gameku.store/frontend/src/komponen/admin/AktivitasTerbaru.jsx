import Ikon from '../Ikon.jsx'
import KosongAdmin from './KosongAdmin.jsx'
import { useDaftar } from '../../layanan/gunakanDaftar.js'
import layananAktivitas from '../../layanan/layananAktivitas.js'
import { waktuRelatif } from '../../data/konstanta.js'

// =====================================================================
// Umpan aktivitas terbaru (timeline).
//
// Sumbernya layananAktivitas, yang hanya mencatat kejadian NYATA dari
// aksi admin. Belum ada aksi => "Belum ada aktivitas."
// =====================================================================
export default function AktivitasTerbaru() {
  const daftar = useDaftar(layananAktivitas)

  if (!daftar.length) {
    return (
      <KosongAdmin
        ikon="jam"
        judul="Belum ada aktivitas."
        deskripsi="Peristiwa admin dan transaksi toko akan tampil di sini."
      />
    )
  }

  return (
    <ul className="daftar-aktivitas">
      {daftar.slice(0, 8).map((a) => (
        <li key={a.id} className="baris-aktivitas">
          <span className={`ikon-aktivitas ${a.warna}`}>
            <Ikon nama={a.ikon} ukuran={16} />
          </span>
          <span className="teks-aktivitas">
            <p>{a.teks}</p>
            <time>{waktuRelatif(a.dibuatPada)}</time>
          </span>
        </li>
      ))}
    </ul>
  )
}
