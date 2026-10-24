import Ikon from '../Ikon.jsx'

// Tombol ikon aksi baris (lihat/edit/hapus) dengan tooltip.
export default function TombolAksi({
  ikon = 'lihat',
  label,
  padaKlik,
  jenis = '',
  nonaktif = false,
}) {
  return (
    <button
      type="button"
      className={`tombol-aksi ${jenis}`}
      onClick={padaKlik}
      data-tip={label}
      aria-label={label}
      disabled={nonaktif}
    >
      <Ikon nama={ikon} ukuran={15.5} />
    </button>
  )
}
