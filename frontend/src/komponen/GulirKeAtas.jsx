import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Mengembalikan posisi gulir ke paling atas setiap kali alamat halaman berubah.
export default function GulirKeAtas() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
