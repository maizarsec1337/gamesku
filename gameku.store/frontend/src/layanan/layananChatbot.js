// =====================================================================
// LAYANAN CHATBOT — lapisan integrasi asisten AI Gamesku.
//
// KEAMANAN: frontend HANYA memanggil endpoint backend milik sendiri
// (bawaan: /api/chat). JANGAN pernah menaruh API key, token, atau secret
// di sini / di frontend mana pun — kunci penyedia AI tetap di server
// (env GAMEKU_CHAT_*). Endpoint kustom tetap bisa diisi lewat
// VITE_CHAT_ENDPOINT bila diperlukan, tetapi bawaan aman tanpa env itu.
//
// KONTRAK backend /api/chat:
//   Request : POST  /api/chat
//             { "pesan": string, "riwayat": [{ "peran": "pengguna"|"asisten", "isi": string }] }
//   Respons : 200 JSON { "ok": true, "data": { "balasan": string } }
//             503 saat provider belum dikonfigurasi -> mode panduan dipakai.
//             429 saat rate limit -> pesan tampil apa adanya.
//
// Bila endpoint 503/belum ada, chatbot berjalan dalam "mode panduan"
// (jawaban statis yang jujur, lihat src/data/panduanChatbot.js) dan
// TIDAK menyamar sebagai AI.
// =====================================================================

const ENDPOINT_ENV = String(import.meta.env?.VITE_CHAT_ENDPOINT || '').trim()
// Bawaan: endpoint backend milik sendiri (relatif, ikut origin + proxy Vite).
const ENDPOINT = ENDPOINT_ENV || '/api/chat'

// Apakah alamat endpoint sudah diketahui (selalu true untuk bawaan).
// Ketersediaan AI aktual ditentukan dari respons server (503 = belum aktif).
export const chatbotTersedia = ENDPOINT.length > 0

// Batas pesan frontend (diselaraskan dengan backend MAKS_PESAN=2000).
const MAKS_PESAN = 2000

// Mengambil teks balasan dari berbagai bentuk respons yang mungkin.
function ambilBalasan(data) {
  if (!data || typeof data !== 'object') return ''
  const kandidat = [
    data.balasan,
    data.jawaban,
    data.message,
    data.isi,
    data?.data?.balasan,
    data?.data?.jawaban,
    data?.data?.message,
  ]
  for (const nilai of kandidat) {
    if (typeof nilai === 'string' && nilai.trim()) return nilai.trim()
  }
  return ''
}

// Mengirim pertanyaan ke endpoint AI. Selalu mengembalikan objek status
// (tidak melempar) supaya komponen bisa menampilkan error/empty state.
export async function tanyaChatbot(pesan, riwayat = []) {
  const isi = String(pesan || '').trim()
  if (!isi) return { berhasil: false, tersedia: chatbotTersedia, pesan: 'Pertanyaan masih kosong.' }
  if (isi.length > MAKS_PESAN) {
    return { berhasil: false, tersedia: true, pesan: `Pesan terlalu panjang (maks ${MAKS_PESAN} karakter).` }
  }
  if (!chatbotTersedia) {
    return { berhasil: false, tersedia: false, pesan: 'Asisten AI belum tersambung.' }
  }

  // Batas waktu 30 detik agar loading tidak menggantung.
  const kontrol = new AbortController()
  const pewaktu = setTimeout(() => kontrol.abort(), 30000)

  try {
    const respons = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan: isi, riwayat }),
      signal: kontrol.signal,
    })
    if (respons.status === 503) {
      return { berhasil: false, tersedia: false, pesan: 'Asisten AI belum dikonfigurasi di server. Menampilkan panduan.' }
    }
    if (respons.status === 429) {
      return { berhasil: false, tersedia: true, pesan: 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.' }
    }
    if (!respons.ok) {
      return { berhasil: false, tersedia: true, pesan: `Server membalas ${respons.status}. Coba lagi nanti.` }
    }
    const data = await respons.json().catch(() => null)
    const balasan = ambilBalasan(data)
    if (!balasan) {
      return { berhasil: false, tersedia: true, pesan: 'Server tidak mengirim balasan.' }
    }
    return { berhasil: true, tersedia: true, balasan }
  } catch (galat) {
    if (galat?.name === 'AbortError') {
      return { berhasil: false, tersedia: true, pesan: 'Waktu menunggu habis. Coba lagi dengan pesan lebih singkat.' }
    }
    return { berhasil: false, tersedia: true, pesan: 'Gagal menghubungi server AI. Periksa koneksi lalu coba lagi.' }
  } finally {
    clearTimeout(pewaktu)
  }
}
