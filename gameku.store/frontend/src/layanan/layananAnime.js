// Layanan Streamku: katalog & metadata anime dari backend PHP (endpoint /api/anime).
// Read-only. Data asli dari backend/api/data_anime_lengkap.json (bukan contoh).
// Catatan: data hanya berisi metadata + tautan halaman episode, BUKAN URL video.

// Vite dev mem-proxy /api ke backend PHP; build produksi menyajikannya dari origin sama.
const DASAR_API = '/api'

// Galat dengan status HTTP agar komponen bisa membedakan jenis masalah.
export class GalatAnime extends Error {
  constructor(pesan, status) {
    super(pesan)
    this.nama = 'GalatAnime'
    this.status = status
  }
}

async function minta(jalur) {
  let respons
  try {
    respons = await fetch(`${DASAR_API}${jalur}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // Gagal jaringan / server mati — jangan diam-diam pakai data contoh.
    throw new GalatAnime('Tidak dapat menghubungi server. Periksa koneksi Anda.', 0)
  }
  let isi = null
  try {
    isi = await respons.json()
  } catch {
    throw new GalatAnime('Respons server tidak dapat dibaca.', respons.status)
  }
  if (!respons.ok || !isi || isi.ok !== true) {
    const pesan = (isi && typeof isi.pesan === 'string' && isi.pesan) || 'Permintaan gagal diproses.'
    throw new GalatAnime(pesan, respons.status)
  }
  return isi.data
}

function susunKueri(params) {
  const q = new URLSearchParams()
  for (const [kunci, nilai] of Object.entries(params || {})) {
    if (nilai !== undefined && nilai !== null && nilai !== '') q.set(kunci, String(nilai))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// GET /api/anime — katalog + pencarian + pagination.
export async function katalogAnime({ q = '', halaman = 1, per } = {}) {
  return minta(`/anime${susunKueri({ q, halaman, per })}`)
}

// GET /api/anime/{slug} — detail seri beserta daftar episode.
export async function detailAnime(slug) {
  return minta(`/anime/${encodeURIComponent(slug)}`)
}

// GET /api/anime/{slug}/episode/{no} — metadata satu episode.
export async function episodeAnime(slug, no) {
  return minta(`/anime/${encodeURIComponent(slug)}/episode/${encodeURIComponent(no)}`)
}

export default {
  katalog: katalogAnime,
  detail: detailAnime,
  episode: episodeAnime,
  GalatAnime,
}
