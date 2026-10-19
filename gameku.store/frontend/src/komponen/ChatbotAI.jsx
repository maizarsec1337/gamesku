// =====================================================================
// ChatbotAI — asisten Gamesku (panel modular, responsif).
// Tombol: ikon robot tanpa teks; tooltip + label aksesibilitas "Buka Asisten".
//
// Mode:
//  - "ai"      : /api/chat menjawab 200 → bertanya ke backend AI.
//  - "panduan" : backend 503/belum dikonfigurasi → jawaban statis JUJUR,
//                hanya mengarahkan ke halaman/fitur Gamesku.
//
// Tidak ada API key di sini. Tidak mengarang produk/harga/stok. Panel
// TIDAK mengunci scroll halaman (hanya area pesan yang menggulir).
// =====================================================================
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Ikon from './Ikon.jsx'
import { tanyaChatbot } from '../layanan/layananChatbot.js'
import {
  ambilPanduan,
  cariPanduan,
  pesanTidakDikenal,
  sapaanPanduan,
  saranTopik,
} from '../data/panduanChatbot.js'
import '../css/chatbot.css'

// Kunci unik untuk tiap pesan.
let urutanPesan = 0
const idPesan = () => `cb-${Date.now().toString(36)}-${(urutanPesan += 1)}`

export default function ChatbotAI() {
  const [terbuka, setTerbuka] = useState(false)
  const [aiAktif, setAiAktif] = useState(null)
  // null = belum tahu; true = AI aktif; false = mode panduan jujur.
  const [pesan, setPesan] = useState(() => [
    {
      id: idPesan(),
      peran: 'asisten',
      isi: sapaanPanduan,
      panduan: true,
      saran: true,
    },
  ])
  const [input, setInput] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [petunjuk, setPetunjuk] = useState('')
  const refPesan = useRef(null)
  const refInput = useRef(null)
  const refTerakhirKirim = useRef(0)
  const idPanel = useId()
  const idLabel = `cb-label`

  // Gulirkan HANYA area pesan (bukan halaman) saat ada pesan baru.
  useEffect(() => {
    const el = refPesan.current
    if (el) el.scrollTop = el.scrollHeight
  }, [pesan, memuat, terbuka])

  // Esc menutup panel.
  useEffect(() => {
    if (!terbuka) return undefined
    const tekan = (e) => {
      if (e.key === 'Escape') setTerbuka(false)
    }
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [terbuka])

  // Fokus input hanya di layar besar agar keyboard virtual mobile tidak
  // langsung menutupi panel saat dibuka.
  useEffect(() => {
    if (!terbuka) return
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      refInput.current?.focus()
    }
  }, [terbuka])

  const tambahPesan = useCallback((baru) => {
    setPesan((lama) => [...lama, { id: idPesan(), ...baru }])
  }, [])

  const kirim = useCallback(
    async (teks) => {
      const isi = String(teks ?? input).trim()
      if (!isi) {
        setPetunjuk('Tulis pertanyaan dulu ya.')
        return
      }
      if (isi.length > 2000) {
        setPetunjuk('Pesan terlalu panjang (maks 2000 karakter).')
        return
      }
      const sekarang = Date.now()
      if (sekarang - refTerakhirKirim.current < 1500) {
        setPetunjuk('Tunggu sebentar sebelum mengirim lagi.')
        return
      }
      refTerakhirKirim.current = sekarang
      setPetunjuk('')
      setInput('')
      tambahPesan({ peran: 'pengguna', isi })

      // Selalu coba backend /api/chat dulu; 503 = AI belum aktif -> panduan.
      setMemuat(true)
      const riwayat = pesan.map((p) => ({ peran: p.peran, isi: p.isi }))
      const hasil = await tanyaChatbot(isi, riwayat)
      setMemuat(false)
      if (hasil.berhasil) {
        setAiAktif(true)
        tambahPesan({ peran: 'asisten', isi: hasil.balasan })
        return
      }
      // Galat nyata (429/jaringan): tampil jelas + tawarkan panduan.
      if (hasil.tersedia !== false) {
        tambahPesan({ peran: 'asisten', isi: hasil.pesan, galat: true, saran: true })
        return
      }
      setAiAktif(false)

      // Mode panduan: jawaban statis jujur, bukan AI.
      const cocok = cariPanduan(isi)
      if (cocok) {
        tambahPesan({
          peran: 'asisten',
          isi: cocok.jawab,
          judul: cocok.judul,
          tautan: cocok.tautan,
          panduan: true,
        })
      } else {
        tambahPesan({ peran: 'asisten', isi: pesanTidakDikenal, panduan: true, saran: true })
      }
    },
    [input, pesan, tambahPesan],
  )

  const kirimTopik = (id) => {
    const item = ambilPanduan(id)
    if (!item) return
    tambahPesan({ peran: 'pengguna', isi: item.label })
    tambahPesan({
      peran: 'asisten',
      isi: item.jawab,
      judul: item.judul,
      tautan: item.tautan,
      panduan: aiAktif !== true,
    })
  }

  const statusTeks = aiAktif === true
    ? 'Terhubung ke AI'
    : aiAktif === false ? 'Mode panduan (AI belum aktif)' : 'Asisten Gamesku'

  return (
    <>
      <button
        type="button"
        className={terbuka ? 'cb-fab cb-fab-aktif' : 'cb-fab'}
        onClick={() => setTerbuka((v) => !v)}
        aria-label={terbuka ? 'Tutup Asisten Gamesku' : 'Buka Asisten Gamesku'}
        title={terbuka ? 'Tutup Asisten Gamesku' : 'Buka Asisten Gamesku'}
        aria-expanded={terbuka}
        aria-controls={idPanel}
      >
        <Ikon nama={terbuka ? 'tutup' : 'robot'} ukuran={24} />
      </button>

      <section
        id={idPanel}
        aria-labelledby={idLabel}
        className={terbuka ? 'cb-panel cb-panel-buka' : 'cb-panel'}
        role="dialog"
        aria-modal="false"
        aria-label="Asisten Gamesku"
        aria-hidden={!terbuka}
      >
        <header className="cb-kepala">
          <span className="cb-avatar" aria-hidden="true"><Ikon nama="chat" ukuran={18} /></span>
          <div className="cb-kepala-teks">
            <strong id={idLabel}>Asisten Gamesku</strong>
            <span>{statusTeks}</span>
          </div>
          <button type="button" className="cb-tutup" onClick={() => setTerbuka(false)} aria-label="Tutup asisten">
            <Ikon nama="tutup" ukuran={17} />
          </button>
        </header>

        <div className="cb-pesan" ref={refPesan} role="log" aria-live="polite">
          {pesan.map((p) => (
            <div key={p.id} className={`cb-balon cb-${p.peran}${p.galat ? ' cb-galat' : ''}`}>
              {p.judul && <strong className="cb-judul">{p.judul}</strong>}
              <p>{p.isi}</p>
              {p.tautan && (
                <Link className="cb-tautan" to={p.tautan.ke} onClick={() => setTerbuka(false)}>
                  {p.tautan.label} <Ikon nama="panahKanan" ukuran={13} />
                </Link>
              )}
              {p.saran && (
                <div className="cb-saran">
                  {saranTopik.map((t) => (
                    <button key={t.id} type="button" onClick={() => kirimTopik(t.id)}>{t.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {memuat && (
            <div className="cb-balon cb-asisten cb-mengetik" role="status" aria-label="Asisten sedang menulis">
              <span /><span /><span />
            </div>
          )}
        </div>

        {!memuat && aiAktif !== true && pesan.length <= 1 && (
          <div className="cb-topik" aria-label="Topik cepat">
            {saranTopik.map((t) => (
              <button key={t.id} type="button" onClick={() => kirimTopik(t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        <form
          className="cb-input"
          onSubmit={(e) => {
            e.preventDefault()
            if (!memuat) kirim()
          }}
        >
          <input
            ref={refInput}
            value={input}
            onChange={(e) => { setInput(e.target.value); if (petunjuk) setPetunjuk('') }}
            placeholder={aiAktif === false ? 'Tulis pertanyaan atau pilih topik…' : 'Tulis pertanyaan…'}
            aria-label="Tulis pertanyaan untuk asisten"
            autoComplete="off"
          />
          <button type="submit" className="cb-kirim" disabled={memuat} aria-label="Kirim pertanyaan">
            {memuat ? <span className="cb-putar" aria-hidden="true" /> : <Ikon nama="panahKanan" ukuran={17} />}
          </button>
        </form>
        {petunjuk && <p className="cb-petunjuk" role="alert">{petunjuk}</p>}
        {aiAktif === false && (
          <p className="cb-catatan">
            Jawaban di atas panduan statis, bukan hasil AI. Integrasi AI menunggu backend
            (<code>GAMEKU_CHAT_ENDPOINT</code>).
          </p>
        )}
      </section>
    </>
  )
}
