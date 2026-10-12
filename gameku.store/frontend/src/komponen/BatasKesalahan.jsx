import { Component } from 'react'

// =====================================================================
// BatasKesalahan — jaring pengaman tampilan.
//
// Tanpa batas ini, satu kesalahan runtime membuat React melepas seluruh
// pohon komponen sehingga halaman terlihat PUTIH KOSONG tanpa penjelasan.
// Dengan batas ini, pesan kesalahan ditampilkan di layar + dicetak ke
// console, sehingga masalahnya terlihat dan dapat diperbaiki.
// =====================================================================
export class BatasKesalahan extends Component {
  constructor(props) {
    super(props)
    this.state = { galat: null }
  }

  static getDerivedStateFromError(galat) {
    return { galat }
  }

  componentDidCatch(galat, info) {
    // Tetap dicetak ke console agar mudah ditelusuri di DevTools.
    console.error('Kesalahan render RAK VIN:', galat, info?.componentStack)
  }

  render() {
    const { galat } = this.state
    if (!galat) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Halaman gagal ditampilkan</h1>
          <p style={{ margin: '0 0 16px', color: '#94a3b8' }}>
            Ada kesalahan saat merender. Buka DevTools → Console untuk melihat
            detail lengkap.
          </p>
          <pre
            style={{
              background: '#111c33',
              border: '1px solid #24324d',
              borderRadius: 10,
              padding: 14,
              overflow: 'auto',
              fontSize: 12.5,
              color: '#fca5a5',
            }}
          >
            {galat?.message || String(galat)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              border: 0,
              borderRadius: 10,
              background: '#62B34A',
              color: '#0b130a',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Muat Ulang
          </button>
        </div>
      </div>
    )
  }
}
