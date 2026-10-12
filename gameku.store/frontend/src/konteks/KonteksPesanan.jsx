import { useCallback, useMemo, useState } from 'react'
import { KonteksPesanan } from './konteksPesanan.js'
import { daftarPesanan, subscribePesanan } from '../layanan/layananPesanan.js'
import { buatNomorPesanan } from '../utilitas/perhitungan.js'

// =====================================================================
// Penyedia data pesanan.
//
// MULAI KOSONG. Tidak ada pesanan contoh, tidak ada akun contoh
// (tidak ada email/wa hardcoded). Daftar awal dibaca dari service
// (localStorage), lalu pesanan baru hasil checkout ditambahkan di atas.
// =====================================================================
export function PenyediaPesanan({ children }) {
  const [daftarPesananState, setDaftarPesananState] = useState(daftarPesanan)
  // Ikut berubah bila service diperbarui dari halaman lain.
  subscribePesanan(() => setDaftarPesananState(daftarPesanan()))

  const buatPesanan = useCallback((dataBaru) => {
    const pesananBaru = {
      id: buatNomorPesanan(),
      dibuatPada: new Date().toISOString(),
      status: 'menunggu-pembayaran',
      metodeId: '',
      biayaLayanan: 0,
      potongan: 0,
      item: [],
      pembeli: { email: '', whatsapp: '' },
      ...dataBaru,
    }

    setDaftarPesananState((sebelumnya) => [pesananBaru, ...sebelumnya])
    return pesananBaru
  }, [])

  const ambilPesanan = useCallback(
    (id) => daftarPesananState.find((pesanan) => pesanan.id === id),
    [daftarPesananState],
  )

  // Mengubah status pesanan, dipakai pada simulasi pembayaran di halaman detail.
  const ubahStatusPesanan = useCallback((idPesanan, statusBaru) => {
    setDaftarPesananState((sebelumnya) =>
      sebelumnya.map((pesanan) =>
        pesanan.id === idPesanan ? { ...pesanan, status: statusBaru } : pesanan,
      ),
    )
  }, [])

  const nilai = useMemo(
    () => ({ daftarPesanan: daftarPesananState, buatPesanan, ambilPesanan, ubahStatusPesanan }),
    [daftarPesananState, buatPesanan, ambilPesanan, ubahStatusPesanan],
  )

  return <KonteksPesanan.Provider value={nilai}>{children}</KonteksPesanan.Provider>
}
