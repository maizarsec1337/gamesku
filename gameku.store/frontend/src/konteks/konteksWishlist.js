import { createContext, useContext } from 'react'

// Konteks wishlist (dipisah dari penyedia untuk fast refresh).
export const KonteksWishlist = createContext(null)

export function useWishlist() {
  const konteks = useContext(KonteksWishlist)
  if (!konteks) {
    throw new Error('useWishlist harus dipakai di dalam PenyediaWishlist.')
  }
  return konteks
}