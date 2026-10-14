// =====================================================================
// LAYANAN STREAMKU — sumber data halaman /streamku.
//
// POLA SAMA seperti layanan lain (layananProduk/layananKategori):
// baca lewat useSyncExternalStore/useDaftar, tulis lewat koleksi.
// MULAI KOSONG. Tidak ada video/stream/kreator contoh.
//
// PERSIAPAN API (kontrak belum diberikan, jadi TIDAK ada fetch di sini):
// - Ganti isi fungsi baca di bawah dengan pemanggilan API resmi nanti,
//   tanpa mengubah komponen (komponen hanya memakai fungsi yang
//   diekspor dari berkas ini).
// - JANGAN mengarang endpoint, format respons, field, maupun mock.
// - Bentuk item yang DIHARAPKAN komponen (dokumentasi, bukan data):
//     { id, judul, kreator, kategori, durasi, thumbnail, urlVideo, url }
//   Semua field opsional; komponen hanya merender field yang benar-benar
//   ada pada item. Tidak ada nilai karangan.
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'

const koleksi = buatKoleksi('streamku', 'stm')

// Berlangganan perubahan daftar (dipakai useSyncExternalStore/useDaftar).
export const subscribeStreamku = (dengar) => koleksi.berlangganan(dengar)

// Daftar video: SELALU dari koleksi nyata (saat ini kosong).
// Nanti: ganti isi dengan hasil API resmi, tetap kembalikan array.
export const daftarVideo = memo(() => koleksi.daftar())

// Satu video berdasarkan id (atau undefined bila tidak ada).
export const ambilVideoId = memo((id) => koleksi.ambil(id))

// Kategori TURUNAN dari data nyata — bukan daftar karangan.
// Kosong bila belum ada video.
export const kategoriVideo = memo(() => {
  const unik = new Set()
  for (const v of koleksi.daftar()) {
    const k = String(v?.kategori || '').trim()
    if (k) unik.add(k)
  }
  return [...unik].sort((a, b) => a.localeCompare(b, 'id'))
})

// Pencarian pada data nyata (judul/kreator/kategori).
// Kata kunci kosong = seluruh daftar nyata.
export const cariVideo = memo((kataKunci) => {
  const kunci = String(kataKunci || '').trim().toLowerCase()
  const semua = koleksi.daftar()
  if (!kunci) return semua
  return semua.filter((v) =>
    `${v?.judul || ''} ${v?.kreator || ''} ${v?.kategori || ''}`.toLowerCase().includes(kunci),
  )
})

// Status integrasi: API resmi BELUM dipasang (kontrak belum diberikan).
// Komponen memakai ini untuk menampilkan catatan kebutuhan secara jujur.
export const STATUS_API_STREAMKU = 'belum-tersedia'

export default {
  daftar: daftarVideo,
  ambil: ambilVideoId,
  kategori: kategoriVideo,
  cari: cariVideo,
  subscribe: subscribeStreamku,
  subscribeStreamku,
  statusApi: STATUS_API_STREAMKU,
}
