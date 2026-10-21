import { createContext, useContext } from 'react'

// Konteks sesi admin (dipisah dari penyedia untuk fast refresh).
// Sesi berasal dari server (cookie PHP + /api/auth/saya) — TIDAK menyimpan
// kata sandi/token sensitif di localStorage/sessionStorage.
export const KonteksAdmin = createContext(null)

export function useAdmin() {
  const konteks = useContext(KonteksAdmin)
  if (!konteks) {
    throw new Error('useAdmin harus dipakai di dalam PenyediaAdmin.')
  }
  return konteks
}
