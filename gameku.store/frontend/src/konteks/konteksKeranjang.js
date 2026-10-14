import { createContext, useContext } from 'react'

// Konteks keranjang (dipisah dari penyedia untuk fast refresh).
export const KonteksKeranjang = createContext(null)

export function useKeranjang() {
  const konteks = useContext(KonteksKeranjang)
  if (!konteks) {
    throw new Error('useKeranjang harus dipakai di dalam PenyediaKeranjang.')
  }
  return konteks
}
