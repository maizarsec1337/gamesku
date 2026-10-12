import { Outlet } from 'react-router-dom'
import Navigasi from './Navigasi.jsx'
import Footer from './Footer.jsx'
import NavigasiBawah from './NavigasiBawah.jsx'

// Tata letak utama marketplace (satu project, siap ditambah PHP nanti).
export default function TataLetak() {
  return (
    <>
      <Navigasi />
      <main className="isi-halaman">
        <Outlet />
      </main>
      <Footer />
      <NavigasiBawah />
    </>
  )
}

