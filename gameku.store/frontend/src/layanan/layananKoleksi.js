// =====================================================================
// LAYANAN KOLEKSI — ponds terakhir yang dipakai semua service RAK VIN.
//
// Menyediakan operasi standar (daftar/tambah/perbarui/hapus) di atas
// localStorage. Tidak ada satu pun data contoh di dalam berkas ini:
// daftar selalu kosong sampai admin mengisinya sendiri.
//
// Nanti di integrasi PHP, ganti isi lima fungsi di bawah dengan fetch()
// ke /api/*.php — bentuk datanya sudah sama dengan kolom tabel.
// =====================================================================

import { baca, tulis, hapus, berlangganan } from './penyimpananLokal.js'

// ID sederhana tanpa dependensi: waktu + angka acak.
function idBaru(awalan) {
  const waktu = Date.now().toString(36)
  const acak = Math.random().toString(36).slice(2, 7)
  return `${awalan}-${waktu}-${acak}`
}

// Membuat service koleksi untuk satu kunci localStorage.
export function buatKoleksi(namaKunci, awalanId = 'id') {
  const daftar = () => {
    const isi = baca(namaKunci, [])
    return Array.isArray(isi) ? isi : []
  }

  const simpan = (isiBaru) => {
    tulis(namaKunci, isiBaru)
    return isiBaru
  }

  return {
    namaKunci,

    daftar,

    // Mencari satu baris berdasarkan id (atau predicate bebas).
    ambil(predikat) {
      return daftar().find((baris) =>
        typeof predikat === 'function' ? predikat(baris) : baris.id === predikat,
      )
    },

    // Menambah satu baris baru. id & waktu dibuat otomatis.
    tambah(data) {
      const baru = {
        id: data?.id ? data.id : idBaru(awalanId),
        dibuatPada: new Date().toISOString(),
        ...data,
      }
      simpan([...daftar(), baru])
      return baru
    },

    // Memperbarui satu baris berdasarkan id.
    perbarui(id, perubahan) {
      let hasil = null
      const isiBaru = daftar().map((baris) => {
        if (baris.id !== id) return baris
        hasil = { ...baris, ...perubahan, id: baris.id, diperbaruiPada: new Date().toISOString() }
        return hasil
      })
      if (hasil) simpan(isiBaru)
      return hasil
    },

    // Menghapus satu baris berdasarkan id.
    hapus(id) {
      const isiBaru = daftar().filter((baris) => baris.id !== id)
      simpan(isiBaru)
      return isiBaru
    },

    // Menghapus banyak baris sekaligus (mis. filter).
    hapusBanyak(ids) {
      simpan(daftar().filter((baris) => !ids.includes(baris.id)))
    },

    // Mengganti seluruh isi (dipakai pengaturan & impor data).
    gantiSemua(isiBaru) {
      simpan(Array.isArray(isiBaru) ? isiBaru : [])
    },

    // Berlangganan perubahan agar komponen React ikut memuat ulang.
    berlangganan: (dengar) => berlangganan(namaKunci, dengar),

    // Membersihkan koleksi ini saja.
    bersihkan: () => hapus(namaKunci),
  }
}
