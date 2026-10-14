// Penyimpanan lapisan dasar (localStorage) dengan berlangganan perubahan.

const RUANG = 'gameku.'
const pendengar = new Map()

// Nomor versi data; naik setiap tulis agar hasil hitungan lama kedaluwarsa.
let versi = 0

const kunciLokal = (nama) => `${RUANG}${nama}`

// memo() menjaga referensi hasil hitungan tetap sama — syarat wajib
// useSyncExternalStore; tanpa ini React render tak berujung (layar kosong).
export function memo(hitung) {
  const wynik = new Map()
  return (...args) => {
    const kunci = args.length ? JSON.stringify(args) : ''
    const tersimpan = wynik.get(kunci)
    if (tersimpan && tersimpan.versi === versi) return tersimpan.nilai
    const nilai = hitung(...args)
    wynik.set(kunci, { versi, nilai })
    return nilai
  }
}

function invalidasi() {
  versi += 1
}

export function baca(nama, nilaiAwal) {
  try {
    const mentah = window.localStorage.getItem(kunciLokal(nama))
    if (mentah === null) return nilaiAwal
    const hasil = JSON.parse(mentah)
    return hasil === null || hasil === undefined ? nilaiAwal : hasil
  } catch {
    return nilaiAwal
  }
}

export function tulis(nama, nilai) {
  try {
    window.localStorage.setItem(kunciLokal(nama), JSON.stringify(nilai))
  } catch {
    // localStorage penuh/diblokir — data tetap hidup di memori React.
  }
  invalidasi()
  siarkan(nama)
  return nilai
}

export function hapus(nama) {
  try {
    window.localStorage.removeItem(kunciLokal(nama))
  } catch {
    // abaikan
  }
  invalidasi()
  siarkan(nama)
}

// Meneruskan perubahan ke semua pendengar satu koleksi.
export function siarkan(nama) {
  const daftar = pendengar.get(nama)
  if (!daftar) return
  for (const dengar of daftar) dengar()
}

export function berlangganan(nama, dengar) {
  if (!pendengar.has(nama)) pendengar.set(nama, new Set())
  pendengar.get(nama).add(dengar)
  return () => pendengar.get(nama)?.delete(dengar)
}

// Mengosongkan seluruh data Gamesku (tombol "Reset Data" di Pengaturan).
export function kosongkanSemua() {
  try {
    const milik = Object.keys(window.localStorage).filter((k) => k.startsWith(RUANG))
    for (const kunci of milik) window.localStorage.removeItem(kunci)
    invalidasi()
    for (const kunci of milik) siarkan(kunci.slice(RUANG.length))
    return milik.length
  } catch {
    return 0
  }
}
