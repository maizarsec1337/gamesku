// =====================================================================
// LAYANAN CHATBOT — lapisan integrasi asisten AI Gamesku.
//
// KEAMANAN: berkas ini HANYA memakai URL endpoint publik dari variabel
// lingkungan build (VITE_CHAT_ENDPOINT). JANGAN pernah menaruh API key,
// token, atau secret di sini / di frontend mana pun — kunci penyedia AI
// harus tetap di server. Frontend cukup tahu ke mana request dikirim.
//
// KONTRAK yang diharapkan dari endpoint (belum tersedia, menunggu
// backend; JANGAN dibuat tanpa persetujuan):
//   Request : POST  <endpoint>
//             { "pesan": string, "riwayat": [{ "peran": "pengguna"|"asisten", "isi": string }] }
//   Respons : 200 JSON — salah satu bentuk:
//             { "ok": true, "data": { "balasan": string } }
//             { "balasan": string } | { "jawaban": string } | { "message": string }
//
// Bila endpoint belum diisi, chatbot berjalan dalam "mode panduan"
// (jawaban statis yang jujur, lihat src/data/panduanChatbot.js) dan
// TIDAK menyamar sebagai AI.
// =====================================================================

const ENDPOINT = String(import.meta.env?.VITE_CHAT_ENDPOINT || '').trim()

// Apakah integrasi AI resmi sudah dikonfigurasi lewat build.
export const chatbotTersedia = ENDPOINT.length > 0

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
  if (!chatbotTersedia) {
    return { berhasil: false, tersedia: false, pesan: 'Asisten AI belum tersambung.' }
  }

  try {
    const respons = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan: isi, riwayat }),
    })
    if (!respons.ok) {
      return { berhasil: false, tersedia: true, pesan: `Server membalas ${respons.status}. Coba lagi nanti.` }
    }
    const data = await respons.json().catch(() => null)
    const balasan = ambilBalasan(data)
    if (!balasan) {
      return { berhasil: false, tersedia: true, pesan: 'Server tidak mengirim balasan.' }
    }
    return { berhasil: true, tersedia: true, balasan }
  } catch {
    return { berhasil: false, tersedia: true, pesan: 'Gagal menghubungi server AI. Periksa koneksi lalu coba lagi.' }
  }
}
