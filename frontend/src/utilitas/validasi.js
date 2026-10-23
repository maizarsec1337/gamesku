// Validasi sederhana untuk isian formulir.

// Email harus memiliki format nama@domain.tld
export function emailValid(nilai) {
  return /^[^@\s]+@[^@\s.]+\.[a-z]{2,}$/i.test(String(nilai || '').trim())
}

// Nomor WhatsApp menerima 10 sampai 14 angka, boleh diawali 0, 62, atau +62.
export function nomorWhatsappValid(nilai) {
  const angka = String(nilai || '').replace(/[\s-]/g, '')
  return /^(\+?62|0)8[0-9]{7,12}$/.test(angka)
}

// ID pengguna game minimal 5 karakter dan tanpa spasi.
export function idPenggunaValid(nilai) {
  const teks = String(nilai || '').trim()
  return teks.length >= 5 && !/\s/.test(teks)
}

// Kata sandi minimal 6 karakter.
export function kataSandiValid(nilai) {
  return String(nilai || '').length >= 6
}
