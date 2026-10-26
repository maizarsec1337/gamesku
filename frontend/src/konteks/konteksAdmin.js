import { createContext, useContext } from 'react'

// Konteks sesi admin (dipisah dari penyedia untuk fast refresh).
// Sesi berasal dari server (cookie HttpOnly + /api/auth/saya) — TIDAK menyimpan
// kata sandi/token sensitif di localStorage/sessionStorage.
// Data tambahan: isSuperadmin — hanya boleh true untuk akun yang ditetapkan
// secara eksplisit di database (peran = 'superadmin' dan email terverifikasi).
export const KonteksAdmin = createContext(null)

export function useAdmin() {
  const konteks = useContext(KonteksAdmin)
  if (!konteks) {
    throw new Error('useAdmin harus dipakai di dalam PenyediaAdmin.')
  }
  return konteks
}
