import { useMemo, useState } from 'react'
import { grafikPenjualan as ambilGrafik } from '../../layanan/layananDasbor.js'
import { formatRupiah } from '../../utilitas/format.js'
import KosongAdmin from './KosongAdmin.jsx'
import '../../css/admin-dasbor.css'

const LEBAR = 760
const TINGGI = 270
const PAD = { kiri: 56, kanan: 14, atas: 16, bawah: 30 }

// Jalur bezier mulus antar titik (tanpa library chart).
function jalurMulus(titik) {
  if (!titik.length) return ''
  let d = `M ${titik[0].x.toFixed(1)} ${titik[0].y.toFixed(1)}`
  for (let i = 1; i < titik.length; i += 1) {
    const a = titik[i - 1]
    const b = titik[i]
    const cx = ((a.x + b.x) / 2).toFixed(1)
    d += ` C ${cx} ${a.y.toFixed(1)}, ${cx} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }
  return d
}

// Label sumbu-y ringkas (juta rupiah).
function labelSumbu(v) {
  const bulat = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
  return `Rp ${String(bulat).replace('.', ',')} jt`
}

// =====================================================================
// Kartu "Ringkasan Penjualan".
//
// Data berasal dari layananDasbor, yang menghitungnya dari pesanan
// berstatus Berhasil. Belum ada transaksi => deret kosong => kartu ini
// menampilkan empty state, bukan grafik dengan titik karangan.
// =====================================================================
export default function GrafikPenjualan() {
  const [periode] = useState(14)
  const [hover, setHover] = useState(null)

  const seri = useMemo(() => ambilGrafik(periode), [periode])
  const adaData = seri.length > 0 && seri.some((s) => s.total > 0)
  const total = adaData ? seri.reduce((jumlah, s) => jumlah + s.total, 0) : 0

  const skala = useMemo(() => {
    if (!adaData) return null
    const maks = Math.max(...seri.map((s) => s.total)) * 1.18
    const w = LEBAR - PAD.kiri - PAD.kanan
    const h = TINGGI - PAD.atas - PAD.bawah
    const keX = (i) => (seri.length === 1 ? w / 2 : (i / (seri.length - 1)) * w) + PAD.kiri
    const keY = (v) => PAD.atas + h - (v / maks) * h

    const titik = seri.map((s, i) => ({ ...s, x: keX(i), y: keY(s.total) }))
    const kisi = []
    for (let g = 4; g >= 0; g -= 1) {
      const nilai = (maks / 4) * g
      kisi.push({ y: keY(nilai), label: labelSumbu(nilai / 1000000) })
    }
    return { titik, kisi, lebar: w, tinggi: h }
  }, [seri, adaData])

  // Belum ada transaksi → empty state.
  if (!adaData || !skala) {
    return (
      <section className="kartu-panel">
        <div className="panel-kepala">
          <div>
            <h3 className="panel-judul">Ringkasan Penjualan</h3>
            <p className="panel-sub">Grafik penjualan toko</p>
          </div>
          <div className="grafik-ringkas">
            <strong>{formatRupiah(0)}</strong>
          </div>
        </div>
        <KosongAdmin
          ikon="grafik"
          judul="Belum ada data penjualan."
          deskripsi="Grafik penjualan akan muncul setelah toko mulai menerima transaksi."
        />
      </section>
    )
  }

  const jalur = jalurMulus(skala.titik)
  const dasarY = PAD.atas + skala.tinggi
  const area = `${jalur} L ${skala.titik.at(-1).x.toFixed(1)} ${dasarY} L ${skala.titik[0].x.toFixed(1)} ${dasarY} Z`

  const geserLabel = skala.titik.length > 14 ? 5 : 1
  const labelTampil = skala.titik.map((t, i) =>
    i % geserLabel === 0 || i === skala.titik.length - 1 ? t.label : null,
  )

  const pindahPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xSvg = ((e.clientX - rect.left) / rect.width) * LEBAR
    const rel = (xSvg - PAD.kiri) / skala.lebar
    const idx = Math.round(rel * (skala.titik.length - 1))
    setHover(Math.max(0, Math.min(skala.titik.length - 1, idx)))
  }

  const fokus = hover != null ? skala.titik[hover] : null
  const posisiTooltip = fokus ? Math.min(90, Math.max(10, (fokus.x / LEBAR) * 100)) : 50

  return (
    <section className="kartu-panel">
      <div className="panel-kepala">
        <div>
          <h3 className="panel-judul">Ringkasan Penjualan</h3>
          <p className="panel-sub">Pendapatan dari pesanan berhasil</p>
        </div>
        <div className="grafik-ringkas">
          <strong>{formatRupiah(total)}</strong>
        </div>
      </div>

      <div className="grafik-wadah">
        <svg
          className="grafik-svg"
          viewBox={`0 0 ${LEBAR} ${TINGGI}`}
          onMouseMove={pindahPointer}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="gradPenjualan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(98,179,74,.34)" />
              <stop offset="100%" stopColor="rgba(98,179,74,0)" />
            </linearGradient>
          </defs>

          {skala.kisi.map((g) => (
            <g key={g.y}>
              <line
                className="grafik-garis-tipis"
                x1={PAD.kiri}
                x2={LEBAR - PAD.kanan}
                y1={g.y}
                y2={g.y}
              />
              <text className="grafik-label" x={PAD.kiri - 10} y={g.y + 4} textAnchor="end">
                {g.label}
              </text>
            </g>
          ))}

          {skala.titik.map((t, i) =>
            labelTampil[i] ? (
              <text
                key={`${t.tanggal}-${i}`}
                className="grafik-label"
                x={t.x}
                y={TINGGI - 8}
                textAnchor="middle"
              >
                {labelTampil[i]}
              </text>
            ) : null,
          )}

          <path d={area} fill="url(#gradPenjualan)" />
          <path d={jalur} fill="none" stroke="#62B34A" strokeWidth="2.6" strokeLinecap="round" />

          {fokus && (
            <g>
              <line
                className="grafik-garis-vertikal"
                x1={fokus.x}
                x2={fokus.x}
                y1={PAD.atas}
                y2={dasarY}
              />
              <circle className="grafik-titik-hover" cx={fokus.x} cy={fokus.y} r="5.5" />
            </g>
          )}
        </svg>

        {fokus && (
          <div className="grafik-info" style={{ left: `${posisiTooltip}%`, top: 4 }}>
            <strong>{fokus.label}</strong>
            <span className="legenda-info">
              <span className="titik-legenda" style={{ background: '#62B34A' }} />
              Penjualan
              <b>{formatRupiah(fokus.total)}</b>
            </span>
          </div>
        )}
      </div>

      <div
        className="baris-ringkas-admin"
        style={{ borderTop: '1px solid var(--adm-border)' }}
      >
        <div className="panel-aksi">
          <span className="legend-grafik">
            <span className="titik-legenda hijau" />
            Penjualan
          </span>
        </div>
        <span className="teks-redup teks-kecil">Dihitung dari pesanan berstatus Berhasil</span>
      </div>
    </section>
  )
}

