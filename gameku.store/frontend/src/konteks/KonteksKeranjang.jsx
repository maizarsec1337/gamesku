import { useCallback, useMemo, useState } from 'react'
import { KonteksKeranjang } from './konteksKeranjang.js'
import { cariPromo, hitungRingkasan, hitungSubtotal } from '../utilitas/perhitungan.js'

// Penyedia data keranjang (mulai kosong; hanya produk yang ditambahkan pembeli).
export function PenyediaKeranjang({ children }) {
  const [daftarItem, setDaftarItem] = useState([])
  const [kodePromo, setKodePromo] = useState('')
  const [pesanPromo, setPesanPromo] = useState('')

  // Menambah item baru, atau menambah jumlah bila item sudah ada.
  const tambahItem = useCallback((itemBaru) => {
    const jumlahTambahan = Number(itemBaru.jumlah) || 1
    setDaftarItem((sebelumnya) => {
      const sudahAda = sebelumnya.find((item) => item.id === itemBaru.id)
      if (sudahAda) {
        return sebelumnya.map((item) =>
          item.id === itemBaru.id
            ? { ...item, jumlah: Math.min(item.jumlah + jumlahTambahan, 10) }
            : item,
        )
      }
      return [...sebelumnya, { ...itemBaru, jumlah: jumlahTambahan }]
    })
    return true
  }, [])

  const hapusItem = useCallback((idItem) => {
    setDaftarItem((sebelumnya) => sebelumnya.filter((item) => item.id !== idItem))
  }, [])

  // Jumlah dibatasi 1 sampai 10 agar tampilan tetap rapi.
  const ubahJumlah = useCallback((idItem, jumlahBaru) => {
    const jumlahRapi = Math.min(Math.max(Number(jumlahBaru) || 1, 1), 10)
    setDaftarItem((sebelumnya) =>
      sebelumnya.map((item) => (item.id === idItem ? { ...item, jumlah: jumlahRapi } : item)),
    )
  }, [])

  const kosongkanKeranjang = useCallback(() => {
    setDaftarItem([])
    setKodePromo('')
    setPesanPromo('')
  }, [])

  // Memakai kode promo. Kode yang tidak dikenali tidak akan disimpan.
  const pasangKodePromo = useCallback(
    (kode) => {
      const kodeRapi = String(kode || '').trim().toUpperCase()
      if (!kodeRapi) {
        setPesanPromo('Masukkan kode promo terlebih dahulu.')
        return false
      }

      const promo = cariPromo(kodeRapi)
      if (!promo) {
        setKodePromo('')
        setPesanPromo(`Kode "${kodeRapi}" tidak dikenali.`)
        return false
      }

      if (hitungSubtotal(daftarItem) <= 0) {
        setPesanPromo('Tambahkan produk dulu sebelum memakai kode promo.')
        return false
      }

      setKodePromo(kodeRapi)
      setPesanPromo(`Kode "${kodeRapi}" berhasil dipakai.`)
      return true
    },
    [daftarItem],
  )

  const hapusKodePromo = useCallback(() => {
    setKodePromo('')
    setPesanPromo('')
  }, [])

  // Ringkasan belanja selalu dihitung ulang dari daftar item terbaru.
  const ringkasan = useMemo(() => hitungRingkasan(daftarItem, kodePromo), [daftarItem, kodePromo])

  const nilai = useMemo(
    () => ({
      daftarItem,
      ...ringkasan,
      kodePromo,
      pesanPromo,
      tambahItem,
      hapusItem,
      ubahJumlah,
      kosongkanKeranjang,
      pasangKodePromo,
      hapusKodePromo,
    }),
    [
      daftarItem,
      ringkasan,
      kodePromo,
      pesanPromo,
      tambahItem,
      hapusItem,
      ubahJumlah,
      kosongkanKeranjang,
      pasangKodePromo,
      hapusKodePromo,
    ],
  )

  return <KonteksKeranjang.Provider value={nilai}>{children}</KonteksKeranjang.Provider>
}
