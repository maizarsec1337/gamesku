// Penyedia wishlist (data lokal, siap diganti API nanti).
import { useCallback, useMemo, useState } from 'react'
import { KonteksWishlist } from './konteksWishlist.js'

export function PenyediaWishlist({ children }) {
  const [daftarSuka, setDaftarSuka] = useState([])

  const alihkanSuka = useCallback((idProduk) => {
    setDaftarSuka((sebelum) => (sebelum.includes(idProduk) ? sebelum.filter((x) => x !== idProduk) : [...sebelum, idProduk]))
  }, [])

  const nilai = useMemo(() => ({
    daftarSuka,
    jumlahSuka: daftarSuka.length,
    disukai: (id) => daftarSuka.includes(id),
    alihkanSuka,
  }), [daftarSuka, alihkanSuka])

  return <KonteksWishlist.Provider value={nilai}>{children}</KonteksWishlist.Provider>
}
