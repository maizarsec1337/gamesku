import { createContext, useContext } from 'react'

// Konteks pesanan (dipisah dari penyedia untuk fast refresh).
export const KonteksPesanan = createContext(null)

export function usePesanan() {
  const konteks = useContext(KonteksPesanan)
  if (!konteks) {
    throw new Error('usePesanan harus dipakai di dalam PenyediaPesanan.')
  }
  return konteks
}
