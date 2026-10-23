import { useEffect } from 'react'
import Ikon from '../Ikon.jsx'

// Jendela modal admin: Esc menutup, klik tirai menutup, isi bebas.
export default function JendelaModal({
  judul,
  padaTutup,
  ukuran = '',
  kaki,
  children,
}) {
  useEffect(() => {
    if (!padaTutup) return undefined
    const tekanEsc = (e) => {
      if (e.key === 'Escape') padaTutup()
    }
    window.addEventListener('keydown', tekanEsc)
    const gulirAsli = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tekanEsc)
      document.body.style.overflow = gulirAsli
    }
  }, [padaTutup])

  if (!padaTutup) return null

  return (
    <div
      className="tirai-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) padaTutup()
      }}
    >
      <div
        className={`jendela-modal ${ukuran}`}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
      >
        <div className="modal-kepala">
          <h3>{judul}</h3>
          <button
            type="button"
            className="modal-tutup"
            onClick={padaTutup}
            aria-label="Tutup jendela"
          >
            <Ikon nama="tutup" ukuran={17} />
          </button>
        </div>
        <div className="modal-badan">{children}</div>
        {kaki && <div className="modal-kaki">{kaki}</div>}
      </div>
    </div>
  )
}
