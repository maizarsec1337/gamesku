// =====================================================================
// PENYIMPANAN LOKAL — lapisan paling dasar untuk seluruh data Gamesku.
////
// TAHAP INI  : browser localStorage (sementara, hanya untuk pratinjau UI).
// TAHAP AKHIR: ganti isi baca/tulis menjadi fetch() ke API PHP.
//               Semua komponen hanya memakai service (src/layanan),
//               sehingga tidak ada satu pun yang perlu diubah tampilan.
//
// Catatan: TIDAK ada data awal. Nilai kosong = database masih kosong.
// =====================================================================

const RUANG = 'gameku.'
const pendengar = new Map()

// Nomor versi data. Setiap kali ada tulisan, versi naik sehingga semua
// hasil hitungan lama dianggap kedaluwarsa.
let versi = 0

const kunciLokal = (nama) => `${RUANG}${nama}`

// =====================================================================
// memo — pembungkus hasil hitungan agar referensinya TETAP SAMA.
//
// INI WAJIB untuk useSyncExternalStore. React membandingkan hasil
// snapshot dengan Object.is; bila tiap panggilan menghasilkan array
// baru, React menganggap data selalu berubah dan masuk render tak
// berujung (layar jadi kosong). Dengan memo, array yang sama dikembalikan
// sampai ada data yang benar-benar ditulis.
// =====================================================================
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

// Membaca satu koleksi dari localStorage. Kunci kosong = array kosong.
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

// Menyimpan satu koleksi lalu memberi tahu seluruh layar yang-storage-nya.
export function tulis(nama, nilai) {
  try {
    window.localStorage.setItem(kunciLokal(nama), JSON.stringify(nilai))
  } catch {
    // localStorage penuh / diblokir — data tetap hidup di memori React.
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

// Meneruskan perubahan ke semua pendengar satu koleksi (agar tabel admin
// ikut berubah saat produk disimpan dari halaman form).
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

// Mengosongkan seluruh data Gamesku (dipakai tombol "Reset Data"
// di halaman Pengaturan).
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
