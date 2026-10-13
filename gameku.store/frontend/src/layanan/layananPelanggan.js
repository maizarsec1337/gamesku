// =====================================================================
// LAYANAN PELANGGAN — akun pembeli Gamesku.
////
// MULAI KOSONG. Tidak ada pelanggan contoh dan tidak ada email/username
// karangan. Pelanggan pertama muncul setelah pendaftaran nyata lewat
// frontend toko atau API PHP.
//
// Bentuk data meniru kolom tabel `pelanggan`.
// =====================================================================

import { buatKoleksi } from './layananKoleksi.js'
import { memo } from './penyimpananLokal.js'
import { STATUS_PELANGGAN } from '../data/konstanta.js'

const koleksi = buatKoleksi('pelanggan', 'pel')

// Berlangganan perubahan pelanggan.
export const subscribePelanggan = (dengar) => koleksi.berlangganan(dengar)

// ---------- Pembacaan (memo: referensi stabil untuk useSyncExternalStore) ----------

export const daftarPelanggan = memo(() => koleksi.daftar())

export const ambilPelangganId = memo((id) => koleksi.ambil(id))

// Mencari pelanggan bebas (nama / username / email).
export const cariPelanggan = memo((kataKunci) => {
  const kunci = String(kataKunci || '').trim().toLowerCase()
  if (!kunci) return daftarPelanggan()
  return daftarPelanggan().filter((p) =>
    `${p.nama} ${p.username} ${p.email}`.toLowerCase().includes(kunci),
  )
})

// Pelanggan baru akan dibuat oleh halaman pendaftaran / API PHP.
export function tambahPelanggan(data) {
  if (!data?.email) return { berhasil: false, pesan: 'Email pelanggan wajib diisi.' }
  const baru = koleksi.tambah({
    nama: data.nama || '',
    username: data.username || '',
    email: data.email,
    totalBeli: 0,
    jumlahPesanan: 0,
    bergabung: data.bergabung || new Date().toISOString(),
    status: STATUS_PELANGGAN[0],
  })
  return { berhasil: true, data: baru }
}

export default {
  daftar: daftarPelanggan,
  ambil: ambilPelangganId,
  cari: cariPelanggan,
  subscribe: subscribePelanggan,
  subscribePelanggan,
  tambah: tambahPelanggan,
}
