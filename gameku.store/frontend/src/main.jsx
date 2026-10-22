import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PenyediaKeranjang } from './konteks/KonteksKeranjang.jsx'
import { PenyediaPesanan } from './konteks/KonteksPesanan.jsx'
import { PenyediaWishlist } from './konteks/KonteksWishlist.jsx'
import { PenyediaAdmin } from './konteks/KonteksAdmin.jsx'
import { PenyediaSesiPembeli } from './konteks/KonteksSesiPembeli.jsx'
import { BatasKesalahan } from './komponen/BatasKesalahan.jsx'
import './css/global.css'
import './css/navigasi.css'
import './css/gameku-tema.css'
import './css/gameku-home.css'
import './css/gameku-komponen.css'
import './css/gameku-kunci.css'
import './css/gameku-redesign.css'
import App from './App.jsx'

// Elemen #root harus ada di index.html.
const akar = document.getElementById('root')
if (!akar) throw new Error('Elemen #root tidak ditemukan pada index.html.')

// Titik masuk aplikasi Gamesku.
createRoot(akar).render(
  <StrictMode>
    <BatasKesalahan>
      <BrowserRouter>
        <PenyediaAdmin>
          <PenyediaWishlist>
            <PenyediaKeranjang>
              <PenyediaPesanan>
                <PenyediaSesiPembeli>
                  <App />
                </PenyediaSesiPembeli>
              </PenyediaPesanan>
            </PenyediaKeranjang>
          </PenyediaWishlist>
        </PenyediaAdmin>
      </BrowserRouter>
    </BatasKesalahan>
  </StrictMode>,
)
