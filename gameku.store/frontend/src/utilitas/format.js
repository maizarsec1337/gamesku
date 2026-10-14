// Fungsi bantu pemformatan angka dan tanggal (format Indonesia).

const pemformatAngka = new Intl.NumberFormat('id-ID')

// Mengubah 22000 menjadi "Rp22.000"
export function formatRupiah(angka) {
  const nilai = Number(angka) || 0
  return `Rp${pemformatAngka.format(nilai)}`
}

// Mengubah 22000 menjadi "22.000"
export function formatAngka(angka) {
  return pemformatAngka.format(Number(angka) || 0)
}

// Mengubah waktu menjadi "26 September 2026 pukul 09.24"
export function formatTanggal(waktu) {
  const tanggal = new Date(waktu)
  if (Number.isNaN(tanggal.getTime())) return '-'
  return tanggal.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Mengubah waktu menjadi "26 Sep 2026, 09.24"
export function formatTanggalSingkat(waktu) {
  const tanggal = new Date(waktu)
  if (Number.isNaN(tanggal.getTime())) return '-'
  return tanggal.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
