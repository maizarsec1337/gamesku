# Laporan Verifikasi: "39.434 Video dari API — Diputar Tanpa Popup, Apakah Benar Bisa?"
**Target data**: 66.29.129.113 (KingBokep/WordPress) — katalog 39.434 video
**Host video (pihak ketiga)**: ystream.id · morencius.com (embed yang direferensikan situs)
**Tanggal uji**: 5 September 2026 · **Metode**: inspeksi teknis + verifikasi langsung
**Status**: Verifikasi selesai — kesimpulan di §5

---

## 1. Pertanyaan yang Diverifikasi

> "Saya punya akses API 39.434 video tanpa batas. Apakah benar bisa membuat pemutaran
> 39.434 video itu TANPA popup?"

Untuk menjawab jujur, "tanpa popup" perlu dipecah menjadi 2 jalur teknis yang berbeda:

| Jalur | Arti | Siapa yang mengendalikan iklan/popup? |
|---|---|---|
| **A. Replay embed** | Tempel iframe `ystream.id/e/...` / `morencius.com/embed/...` di halaman sendiri | **Pemilik host** (di dalam iframe) |
| **B. File langsung** | Ambil file video mentah (m3u8/mp4) dari balik player host, putar dengan player sendiri | **Anda** (100%) |

Jalur B adalah SATU-SATUNYA cara popup-free sejati — tetapi membutuhkan akses ke
infrastruktur host pihak ketiga, bukan ke API WordPress target.

---

## 2. Bukti Teknis — Apa yang Sebenarnya Dilindungi Host Video

### 2.1 morencius.com (JW Player 8 + konfigurasi ter-packing)
Inspeksi langsung `https://morencius.com/embed/<id>` (17.372 byte) menemukan:

- `jwplayer.key="ITWMv7t88..."` → memakai **JW Player** (library pemutar komersial).
- Konfigurasi player dikirim **ter-obfuscate/ter-packing** lalu di-`eval` saat runtime.
  Di dalamnya terlihat **array multi-URL stream** (mirror CDN berbeda) yang baru dipilih
  saat halaman berjalan — URL file video TIDAK ada mentah di HTML.
- Token/angka yang tampak: `129600` (≈ **36 jam**) → URL stream **ditandatangani &
  kedaluwarsa**; `srv/asn/p1/p2` (parameter penandatangan CDN). Artinya tautan langsung
  **berotasi** dan harus di-refresh berkala.
- Referensi jaringan iklan: `/ad?type=63365507802`, `ev-p2.js?type=adult&u=25486`,
  `adstub`, plus kata kunci di dalam player: **`popunder`**, `itads`, `vvad` →
  perilaku popup/iklan **tertanam dalam logika player**.
- Ada **dinding AdBlock**: *"Please disable AdBlock to watch this video!"*
  (video tidak mau jalan kalau AdBlock aktif).
- Ada `window.open` (1×) dan `eval` (1×) di halaman.

**Simpulan 2.1**: embed morencius = pemutar dengan iklan/popunder bawaan.
Replay iframe jalur A ⇒ **popup tetap muncul**; jalur B ⇒ URL bertoken ber-TTL,
butuh deobfuscation + refresh terus-menerus.

### 2.2 ystream.id (SPA React + API internal ber-session)
Inspeksi `https://ystream.id/e/<id>` (shell 1.605 byte) + bundel
`/assets/index-DocunfmE.js` (282.104 byte):

- Frontend React murni; logika dimuat lewat JS.
- Seluruh data diambil via **API internal** berpola `/api/<resource>` dengan
  `sessionToken` / `session` (lihat kode: `sessionToken:k.sessionToken`, `embedDomain`,
  server pool). Ada route `/api/admin/...` khusus admin.
- **Tidak ada** URL `.m3u8`/`.mp4` statis di HTML maupun bundel JS.
- Stream hanya bisa diperoleh dengan **menjalankan aplikasi** (browser headless) dan
  mengikuti alur sesi/API — jauh lebih berat daripada sekadar parsing.

**Simpulan 2.2**: embed ystream = aplikasi tertutup. Jalur A ⇒ tidak bisa diverifikasi
tanpa runtime browser; Jalur B ⇒ harus reverse-engineering API ber-sesi milik pihak
ketiga.

### 2.3 Data dari API target (66.29.129.113) — hanya metadata, bukan video
Yang benar-benar "tanpa batas" dari API WordPress target hanyalah **katalog**:
judul, kategori, tanggal, deskripsi, tautan embed. File video TIDAK pernah disajikan
oleh API target; semuanya berada di host pihak ketiga di atas. (Bukti: dump penuh
39.434 record berisi kolom link embed, bukan file video.)

---

## 3. Skala: Apa Artinya untuk 39.434 Video

| Kebutuhan untuk Jalur B (popup-free sejati) | Skala 39.434 video |
|---|---|
| Eksekusi JS/deobfuscation per video (morencius) / sesi API per video (ystream) | ±39.434 operasi pemutar-headless, bukan sekadar HTTP GET |
| URL bertoken ber-TTL ±36 jam (morencius) | Refresh berkala seluruh tautan agar player tidak mati |
| Ketergantungan pada perubahan player host | Perubahan kecil di host = seluruh pipeline perlu diperbaiki |
| Ketahanan (host bisa blokir pola scraping) | Tidak ada jaminan; berisiko IP/akun diblokir |
| Kepatuhan | Melanggar ToS host pihak ketiga + isu hak cipta konten berlisensi |

Artinya: untuk **satu-dua video**, mengekstrak file langsung lalu memutar bersih
adalah hal yang lazim dan bisa dibuktikan. Untuk **39.434 video secara andal dan
berkelanjutan**, itu berarti membangun & memelihara operasi scraping terhadap dua
host pihak ketiga yang justru melindungi stream-nya (token, sesi, JS, anti-AdBlock,
popunder) — bukan sekadar "pakai API tanpa batas".

---

## 4. Verifikasi Klaim

| Klaim | Status | Bukti |
|---|---|---|
| API 66.29.129.113 bisa diambil tanpa batas (39.434 katalog) | ✅ **BENAR** | dump penuh 8,2 menit, 200/200 halaman, 0 blokir |
| Katalog memuat tautan embed untuk tiap video | ✅ **BENAR** | sampel 60/60 punya embed + thumbnail |
| Video bisa diputar lewat iframe host TANPA popup | ❌ **TIDAK DIJAMIN** | morencius terbukti memuat ad/popunder + anti-AdBlock; ystream tak dapat diverifikasi statis |
| File video langsung bisa diambil & diputar bersih (popup-free) | ⚠️ **MUNGKIN per-video, TIDAK ANDAL/LEGAL massal** | morencius: URL packed + bertoken TTL 36 jam; ystream: API ber-sesi; keduanya host pihak ketiga |
| "39.434 video tanpa popup" sebagai produk andal dari API ini | ❌ **TIDAK BENAR-BENAR BISA** (secara andal & sah) | gabungan bukti §2–§3 |

---

## 5. Kesimpulan

1. **API target memang tanpa batas** — tetapi hanya untuk **metadata katalog**,
   bukan untuk file video. Tidak ada "video stream" yang disediakan API tersebut.
2. Video sebenarnya hidup di **ystream.id / morencius.com**, dan kedua host itu
   **melindungi stream-nya**: morencius dengan player JW yang ter-packing, tautan
   bertoken ber-TTL (±36 jam) dan logika popunder/anti-AdBlock tertanam; ystream
   dengan API internal ber-sesi yang tidak mengekspos file apa pun secara statis.
3. Karena itu **"tanpa popup" hanya bisa dicapai lewat jalur B** (ambil file langsung,
   putar sendiri). Itu terbukti **tidak praktis dan tidak sah** untuk 39.434 video:
   butuh eksekusi headless per video, refresh token berkala, pemeliharaan kontinu,
   melanggar ToS host, dan tetap bermasalah hak cipta untuk konten berlisensi.
4. **Jawaban final**: "Bisa memutar 39rb video tanpa popup dari API" = **TIDAK benar
   sebagai klaim yang andal/legal**. Yang benar hanyalah: katalog API-nya bocor tanpa
   batas (temuan keamanan nyata), sedangkan pemutaran bersih adalah masalah yang
   berada di luar kendali API tersebut.

### Rekomendasi (sesuai tujuan)
- **Keamanan**: kunci API (rate-limit, blokir listing anonim) — lihat laporan utama.
- **Produk video bersih yang sah**: bangun situs dengan **konten milik sendiri**
  (upload langsung ke hosting Anda, mp4/m3u8 + player Plyr/Video.js tanpa SDK iklan).
- **Jika ingin konten berlisensi**: gunakan API/afiliasi resmi studio atau platform
  partner — bukan scraping embed host pihak ketiga.

---

## 6. Lampiran Bukti (lokal)
- `morencius.html` (17.372 B) — halaman embed: jwplayer.key, config ter-packing,
  `/ad`, `ev-p2.js?type=adult`, anti-AdBlock, `window.open`, `eval`.
- `ystream.html` (1.605 B) — shell SPA "Byse Frontend".
- `ystream.js` (282.104 B) — bundel React: pola `/api/<resource>`, `sessionToken`,
  server pool, route `/api/admin/`.
- `sampel_record_lengkap.csv`, `dump_api_39434_vidio.csv` — data katalog dari API target.

