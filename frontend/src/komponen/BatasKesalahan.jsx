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
    console.error('Kesalahan render Gamesku:', galat, info?.componentStack)
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
          background: '#0B0D1E',
          color: '#F4F7FF',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Halaman gagal ditampilkan</h1>
          <p style={{ margin: '0 0 16px', color: '#A7B2D0' }}>
            Ada kesalahan saat merender. Buka DevTools → Console untuk melihat
            detail lengkap.
          </p>
          <pre
            style={{
              background: '#0D1530',
              border: '1px solid #263663',
              borderRadius: 10,
              padding: 14,
              overflow: 'auto',
              fontSize: 12.5,
              color: '#FFA9BA',
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
              background: '#43DDF5',
              color: '#0B0D1E',
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
