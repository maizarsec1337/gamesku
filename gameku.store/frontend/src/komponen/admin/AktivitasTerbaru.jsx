import Ikon from '../Ikon.jsx'
import KosongAdmin from './KosongAdmin.jsx'
import { useApi } from '../../layanan/gunakanApi.js'
import { daftarAktivitasApi } from '../../layanan/apiAdmin.js'
import { waktuRelatif } from '../../data/konstanta.js'

// =====================================================================
// Umpan aktivitas terbaru (timeline) — dibaca dari server (GET /api/aktivitas).
// Hanya berisi kejadian NYATA dari aksi admin/toko. Belum ada => empty state.
// =====================================================================
export default function AktivitasTerbaru() {
  const { data, memuat } = useApi(() => daftarAktivitasApi(8), [])
  const daftar = Array.isArray(data) ? data : []

  if (memuat) {
    return (
      <div className="keadaan-kosong keadaan-kosong-admin" role="status">
        <span className="cb-putar" aria-hidden="true" />
      </div>
    )
  }

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
            <time>{waktuRelatif(a.waktu || a.dibuat_pada)}</time>
          </span>
        </li>
      ))}
    </ul>
  )
}
