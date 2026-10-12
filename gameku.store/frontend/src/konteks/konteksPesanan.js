import { createContext, useContext } from 'react'

// Konteks pesanan dipisah dari komponen penyedia agar berkas ini hanya
// berisi konteks dan hook.
export const KonteksPesanan = createContext(null)

// Hook untuk memakai data pesanan di komponen mana pun.
export function usePesanan() {
  const konteks = useContext(KonteksPesanan)
  if (!konteks) {
    throw new Error('usePesanan harus dipakai di dalam PenyediaPesanan.')
  }
  return konteks
}
