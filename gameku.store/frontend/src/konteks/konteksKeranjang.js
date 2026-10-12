import { createContext, useContext } from 'react'

// Konteks keranjang sengaja dipisah dari komponen penyedia agar berkas ini
// hanya berisi konteks dan hook (membantu proses fast refresh saat dev).
export const KonteksKeranjang = createContext(null)

// Hook untuk memakai data keranjang di komponen mana pun.
export function useKeranjang() {
  const konteks = useContext(KonteksKeranjang)
  if (!konteks) {
    throw new Error('useKeranjang harus dipakai di dalam PenyediaKeranjang.')
  }
  return konteks
}
