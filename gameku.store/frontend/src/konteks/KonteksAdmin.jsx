import { useCallback, useRef, useState } from 'react'
import { KUNCI_SESI_ADMIN, KonteksAdmin } from './konteksAdmin.js'

// =====================================================================
// Penyedia sesi admin + toast pesan global untuk halaman admin.
//
// AUTENTIKASI: belum ada. Tidak ada akun, tidak ada kredensial, tidak
// ada validasi username/password di sisi peramban. Form login hanya
// tampilan (UI) sampai modul PHP tersedia.
//
// Nanti begini (contoh, belum ditulis di sini):
//   const respons = await fetch('/api/admin/masuk.php', {
//     method: 'POST',
//     body: JSON.stringify({ pengguna, sandi }),
//   })
//   // Server yang memeriksa password_verify() dan membuat session PHP.
// =====================================================================
export function PenyediaAdmin({ children }) {
  // Sesi ditandai oleh server. Selama belum ada server, nilainya null
  // sehingga panel admin tetap bisa dibuka untuk melihat tampilan UI.
  const [sesiServer, setSesiServer] = useState(() => {
    try {
      return sessionStorage.getItem(KUNCI_SESI_ADMIN)
    } catch {
      return null
    }
  })
  const [pesan, setPesan] = useState('')
  const penghitung = useRef(null)

  // Mengganti hasil masuk dengan status dari server. Hanya server PHP
  // yang boleh memanggil ini (melalui API), bukan kode bawaan.
  const tetapkanSesi = useCallback((dataSesi) => {
    try {
      if (dataSesi) sessionStorage.setItem(KUNCI_SESI_ADMIN, JSON.stringify(dataSesi))
      else sessionStorage.removeItem(KUNCI_SESI_ADMIN)
    } catch {
      // sessionStorage tidak tersedia — abaikan.
    }
    setSesiServer(dataSesi)
  }, [])

  const keluar = useCallback(() => {
    try {
      sessionStorage.removeItem(KUNCI_SESI_ADMIN)
    } catch {
      // abaikan
    }
    setSesiServer(null)
  }, [])

  // Toast singkat di pojok kanan bawah (umpan balik aksi CRUD).
  const tampilkanPesan = useCallback((teks) => {
    setPesan(teks)
    window.clearTimeout(penghitung.current)
    penghitung.current = window.setTimeout(() => setPesan(''), 2600)
  }, [])

  return (
    <KonteksAdmin.Provider
      value={{ sesiServer, tetapkanSesi, keluar, pesan, tampilkanPesan }}
    >
      {children}
    </KonteksAdmin.Provider>
  )
}
