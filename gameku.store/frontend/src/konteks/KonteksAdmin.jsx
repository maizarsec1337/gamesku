import { useCallback, useEffect, useRef, useState } from 'react'
import { KonteksAdmin } from './konteksAdmin.js'
import { sesiAdmin, masukAdmin, keluarAdmin } from '../layanan/apiAdmin.js'

// Penyedia sesi admin (backend PHP) + toast pesan global untuk halaman admin.
//
// Sesi diverifikasi server via GET /api/auth/saya (cookie PHP). Tidak ada
// kredensial yang disimpan di browser — hanya objek sesi (id, pengguna,
// nama, peran) yang dikembalikan server.
export function PenyediaAdmin({ children }) {
  const [sesiServer, setSesiServer] = useState(null)
  const [memuatSesi, setMemuatSesi] = useState(true)
  const [pesan, setPesan] = useState('')
  const penghitung = useRef(null)
  const refMounted = useRef(true)

  // Muat sesi dari server saat aplikasi dimulai.
  useEffect(() => {
    refMounted.current = true
    ;(async () => {
      try {
        const sesi = await sesiAdmin()
        if (refMounted.current) setSesiServer(sesi)
      } catch {
        if (refMounted.current) setSesiServer(null)
      } finally {
        if (refMounted.current) setMemuatSesi(false)
      }
    })()
    return () => {
      refMounted.current = false
    }
  }, [])

  // Login: verifikasi dilakukan backend (password_verify). Melempar GalatApi bila gagal.
  const masuk = useCallback(async (pengguna, sandi) => {
    const data = await masukAdmin(pengguna, sandi)
    setSesiServer(data)
    return data
  }, [])

  // Logout: akhiri sesi di server, lalu bersihkan state.
  const keluar = useCallback(async () => {
    try {
      await keluarAdmin()
    } catch {
      // Tetap bersihkan state lokal meski server tidak merespons.
    }
    setSesiServer(null)
  }, [])

  const tampilkanPesan = useCallback((teks) => {
    setPesan(teks)
    window.clearTimeout(penghitung.current)
    penghitung.current = window.setTimeout(() => setPesan(''), 2600)
  }, [])

  const peran = sesiServer?.peran || ''
  // Superadmin hanya boleh akun yang TETAP: peran='superadmin' AND email='gameku.myid@gmail.com'
  // Menegakkan di frontend agar UI tidak menampilkan fitur superadmin bagi pengguna lain.
  // Validasi ketat tetap dilakukan di backend melalui Auth::wajibPeran('superadmin').
  const emailSuperadmin = 'gameku.myid@gmail.com'
  const isSuperadmin = peran === 'superadmin' && (
    (sesiServer?.email || '').toLowerCase() === emailSuperadmin ||
    (sesiServer?.pengguna || '').toLowerCase() === emailSuperadmin
  )

  return (
    <KonteksAdmin.Provider
      value={{
        sesiServer,
        memuatSesi,
        masuk,
        keluar,
        pesan,
        tampilkanPesan,
        peran,
        isSuperadmin,
        emailSuperadmin,
      }}
    >
      {children}
    </KonteksAdmin.Provider>
  )
}
