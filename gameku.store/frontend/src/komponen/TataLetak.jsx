import { Outlet } from 'react-router-dom'
import Navigasi from './Navigasi.jsx'
import Footer from './Footer.jsx'
import NavigasiBawah from './NavigasiBawah.jsx'
import ChatbotAI from './ChatbotAI.jsx'

// Tata letak utama marketplace (navigasi atas + navigasi bawah + footer + chatbot).
export default function TataLetak() {
  return (
    <div className="etalase">
      <Navigasi />
      <main className="isi-halaman">
        <Outlet />
      </main>
      <Footer />
      <NavigasiBawah />
      <ChatbotAI />
    </div>
  )
}

