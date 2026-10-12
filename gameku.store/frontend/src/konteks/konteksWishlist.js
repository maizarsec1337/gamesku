import { createContext, useContext } from 'react'

// Konteks wishlist sengaja dipisah dari komponen penyedia agar berkas ini
// hanya berisi konteks dan hook (membantu proses fast refresh saat dev).
export const KonteksWishlist = createContext(null)

// Hook untuk memakai data wishlist di komponen mana pun.
export function useWishlist() {
  const konteks = useContext(KonteksWishlist)
  if (!konteks) {
    throw new Error('useWishlist harus dipakai di dalam PenyediaWishlist.')
  }
  return konteks
}