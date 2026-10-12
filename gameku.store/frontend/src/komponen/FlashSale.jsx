// Flash Sale GameKU — timer mundur + kartu horizontal dari data asli.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import KartuProduk from './KartuProduk.jsx'

function sisaHariIni() {
  const now = new Date()
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const s = Math.max(0, Math.floor((end - now) / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const d = String(s % 60).padStart(2, '0')
  return [h, m, d]
}

export default function FlashSale({ daftar = [] }) {
  const [waktu, setWaktu] = useState(sisaHariIni)
  useEffect(() => {
    const t = setInterval(() => setWaktu(sisaHariIni()), 1000)
    return () => clearInterval(t)
  }, [])
  const isi = useMemo(() => daftar.slice(0, 8), [daftar])
  if (!isi.length) return null
  return (
    <section className="reveal" aria-label="Flash Sale">
      <div className="flash">
        <div className="flash-head">
          <h2>Flash Sale</h2>
          <span className="flash-timer" aria-label="Berakhir dalam"><b>{waktu[0]}</b>:<b>{waktu[1]}</b>:<b>{waktu[2]}</b></span>
        </div>
        <p style={{ fontSize: 12.5, color: '#BFDBFE', marginTop: 4 }}>Diskon asli dari katalog · berakhir tengah malam.</p>
        <div className="flash-row">
          {isi.map((p) => (<KartuProduk key={p.id} produk={p} modeFlash />))}
        </div>
        <Link to="/promo" className="tombol tombol-kuning tombol-kecil" style={{ marginTop: 10 }}>Lihat Semua Promo →</Link>
      </div>
    </section>
  )
}
