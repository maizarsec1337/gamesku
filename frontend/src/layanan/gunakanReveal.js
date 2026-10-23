// Hook reveal ringan — tambahkan .tampil saat section masuk viewport.
// `kunci` opsional (mis. status loading): saat nilainya berubah, observer
// dipasang ulang agar node .reveal hasil render baru ikut terpantau —
// kalau tidak, node baru tak pernah dapat .tampil dan tetap opacity:0.
import { useEffect } from 'react'

export default function useReveal(kunci = 0) {
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
  }, [kunci])
}
