import { createContext, useContext } from 'react'

// Konteks sesi admin — sengaja dipisah dari penyedia (fast refresh).
export const KonteksAdmin = createContext(null)

// =====================================================================
// AUTENTIKASI ADMIN
//
// TIDAK ADA AKUN DEMO, TIDAK ADA KREDENSIAL DALAM KODE.
//
// Tiga hal yang SENGAJA tidak ada di berkas ini maupun project mana pun:
//   1. username bawaan
//   2. password bawaan
//   3. bypass login dengan kombinasi tertentu
//
// Saat backend PHP siap, `masuk()` diarahkan ke:
//   POST /api/admin/masuk.php
// dengan password_hash() + password_verify() + session PHP di sisi
// server. Frontend hanya menampilkan form; keputusan masuk sepenuhnya
// milik server.
// =====================================================================

// Kunci penanda bahwa modul autentikasi sudah terhubung ke server.
// Kosong selama autentikasi hanya berupa tampilan (UI preview).
export const KUNCI_SESI_ADMIN = 'gameku_sesi_admin'

// Hook untuk memakai sesi admin di komponen mana pun.
export function useAdmin() {
  const konteks = useContext(KonteksAdmin)
  if (!konteks) {
    throw new Error('useAdmin harus dipakai di dalam PenyediaAdmin.')
  }
  return konteks
}
