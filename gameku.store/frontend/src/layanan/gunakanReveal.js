// Hook reveal ringan — tambahkan .tampil saat section masuk viewport.
import { useEffect } from 'react'

export default function useReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('tampil'))
      return undefined
    }
    const els = Array.from(document.querySelectorAll('.reveal'))
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((el) => el.classList.add('tampil'))
      return undefined
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('tampil')
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}
