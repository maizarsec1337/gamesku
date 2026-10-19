import { useCallback, useRef, useState } from 'react'
import { KUNCI_SESI_ADMIN, KonteksAdmin } from './konteksAdmin.js'

// Penyedia sesi admin + toast pesan global untuk halaman admin.
export function PenyediaAdmin({ children }) {
  const [sesiServer, setSesiServer] = useState(() => {
    try {
      return sessionStorage.getItem(KUNCI_SESI_ADMIN)
    } catch {
      return null
    }
  })
  const [pesan, setPesan] = useState('')
  const penghitung = useRef(null)

  // Sesuai keputusan server (bukan nilai bawaan di kode).
  const tetapkanSesi = useCallback((dataSesi) => {
    try {
      if (dataSesi) sessionStorage.setItem(KUNCI_SESI_ADMIN, JSON.stringify(dataSesi))
      else sessionStorage.removeItem(KUNCI_SESI_ADMIN)
    } catch {
      // sessionStorage tidak tersedia — abaikan.
    }
    setSesiServer(dataSesi)
  }, [])

  const keluar = useCallback(() => {
    try {
      sessionStorage.removeItem(KUNCI_SESI_ADMIN)
    } catch {
    }
    setSesiServer(null)
  }, [])

  // Toast singkat (umpan balik aksi CRUD).
  const tampilkanPesan = useCallback((teks) => {
    setPesan(teks)
    window.clearTimeout(penghitung.current)
    penghitung.current = window.setTimeout(() => setPesan(''), 2600)
  }, [])

  return (
    <KonteksAdmin.Provider
      value={{ sesiServer, tetapkanSesi, keluar, pesan, tampilkanPesan }}
    >
      {children}
    </KonteksAdmin.Provider>
  )
}
