// Layanan Streamku: sumber data halaman /streamku (mulai kosong; API menyusul).

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'

const koleksi = buatKoleksi('streamku', 'stm')

export const subscribeStreamku = (dengar) => koleksi.berlangganan(dengar)

export const daftarVideo = memo(() => koleksi.daftar())

export const ambilVideoId = memo((id) => koleksi.ambil(id))

// Kategori diturunkan dari data nyata; kosong bila belum ada video.
export const kategoriVideo = memo(() => {
  const unik = new Set()
  for (const v of koleksi.daftar()) {
    const k = String(v?.kategori || '').trim()
    if (k) unik.add(k)
  }
  return [...unik].sort((a, b) => a.localeCompare(b, 'id'))
})

// Pencarian judul/kreator/kategori; kata kunci kosong = seluruh daftar.
export const cariVideo = memo((kataKunci) => {
  const kunci = String(kataKunci || '').trim().toLowerCase()
  const semua = koleksi.daftar()
  if (!kunci) return semua
  return semua.filter((v) =>
    `${v?.judul || ''} ${v?.kreator || ''} ${v?.kategori || ''}`.toLowerCase().includes(kunci),
  )
})

// Status integrasi API (belum tersedia sampai kontrak diberikan).
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
