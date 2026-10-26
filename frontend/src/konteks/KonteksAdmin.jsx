import { useCallback, useEffect, useRef, useState } from 'react'
import { KonteksAdmin } from './konteksAdmin.js'
import { sesiAdmin, masukAdmin, keluarAdmin } from '../layanan/apiAdmin.js'

// Penyedia sesi admin (backend Express) + toast pesan global untuk halaman admin.
//
// Sesi diverifikasi server via GET /api/auth/saya (cookie HttpOnly). Tidak ada
// kredensial yang disimpan di browser — hanya objek sesi (id, pengguna,
// nama, peran) yang dikembalikan server.
export function PenyediaAdmin({ children }) {
  const [sesiServer, setSesiServer] = useState(null)
  const [memuatSesi, setMemuatSesi] = useState(true)
  const [pesan, setPesan] = useState('')
  const penghitung = useRef(null)
  const versiSesi = useRef(0)

  // Muat sesi dari server saat aplikasi dimulai.
  useEffect(() => {
    let abaikan = false
    const versi = versiSesi.current
    ;(async () => {
      try {
        const sesi = await sesiAdmin()
        if (!abaikan && versi === versiSesi.current) setSesiServer(sesi)
      } catch {
        if (!abaikan && versi === versiSesi.current) setSesiServer(null)
      } finally {
        if (!abaikan && versi === versiSesi.current) setMemuatSesi(false)
      }
    })()
    return () => {
      abaikan = true
    }
  }, [])

  // Login: verifikasi hash dilakukan backend. Melempar GalatApi bila gagal.
  const masuk = useCallback(async (pengguna, sandi) => {
    const data = await masukAdmin(pengguna, sandi)
    versiSesi.current += 1
    setSesiServer(data)
    setMemuatSesi(false)
    return data
  }, [])

  // Logout: akhiri sesi di server, lalu bersihkan state.
  const keluar = useCallback(async () => {
    await keluarAdmin()
    versiSesi.current += 1
    setSesiServer(null)
  }, [])

  const tampilkanPesan = useCallback((teks) => {
    setPesan(teks)
    window.clearTimeout(penghitung.current)
    penghitung.current = window.setTimeout(() => setPesan(''), 2600)
  }, [])

  const peran = sesiServer?.peran || ''
  // Hak akses ditentukan oleh peran dari server. Jangan mengunci superadmin
  // ke email tertentu: akun pemilik dapat memakai username (mis. maizardev).
  // Endpoint backend tetap menegakkan Auth::wajibPeran('superadmin').
  const emailSuperadmin = sesiServer?.email || ''
  const isSuperadmin = peran === 'superadmin'

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
