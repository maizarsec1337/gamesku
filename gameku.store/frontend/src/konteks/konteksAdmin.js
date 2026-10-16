import { createContext, useContext } from 'react'

// Konteks sesi admin (dipisah dari penyedia untuk fast refresh).
export const KonteksAdmin = createContext(null)

export const KUNCI_SESI_ADMIN = 'gameku_sesi_admin'

export function useAdmin() {
  const konteks = useContext(KonteksAdmin)
  if (!konteks) {
    throw new Error('useAdmin harus dipakai di dalam PenyediaAdmin.')
  }
  return konteks
}
