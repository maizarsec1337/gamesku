# Laporan: Dump Penuh API (Tanpa Batas) & Kelayakan Membangun Website Baru
**Target**: 66.29.129.113 — KingBokep (WordPress, tema KingTube/WPST)
**Tanggal uji**: 5 September 2026 · **Metode**: Black-box, REST API publik tanpa kredensial
**File pendukung**: `dump_api_39434_vidio.csv` (hasil dump penuh), `sampel_record_lengkap.csv`, `dump_all_api.py`

---

## 1. Eksekusi Dump Penuh — TERBUKTI TANPA BATAS

Dump **seluruh katalog video** dieksekusi langsung dari API publik, tanpa login,
tanpa token, tanpa jeda anti-bot:

| Metrik | Hasil |
|---|---|
| Total video | **39.434 record** (id unik 39.434, duplikat 0) |
| Durasi dump | **493 detik (±8,2 menit)** — 395 permintaan `per_page=100` |
| Kode status | 200/200 halaman sukses (dengan retry otomatis, 0 blokir 429/403) |
| Kategori | Bokep Indo **31.857**, Bokep Jilbab **2.343**, JAV Sub Indo **5.234** (= 39.434 ✔) |
| Rentang konten | 2021-05-23 → 2026-09-04 (5+ tahun arsip) |
| Data kosong | Judul 0, link 0 |
| Ukuran file | 7,84 MB (CSV) |
| Estimasi percobaan ulang | ~8 menit sekali jalan, bisa diparalelkan |

```
$ python3 dump_all_api.py
[10:17:xx] X-WP-Total=39434 X-WP-TotalPages=395 | range halaman 1..395
[10:25:51] page 395/395 | 39434 record chunk | 493 dtk | 80.02 rec/dtk
[10:25:51] CHUNK SELESAI halaman 1..395 -> 39434 record
```

**Kesimpulan F2 (laporan sebelumnya) terkonfirmasi di skala penuh**: tidak ada
batas permintaan, batas halaman, kuota token, maupun throttling. Seluruh basis
data video dapat disalin berulang kali tanpa hambatan.

---

## 2. Data yang Tersedia untuk "Membangun Website Baru"

### 2.1 Langsung dari REST API (tanpa buka halaman satu per satu) — 100% video
| Data | Sumber | Catatan |
|---|---|---|
| Judul | `title.rendered` | Ada di 39.434/39.434 |
| Link permalink | `link` | Ada di 39.434/39.434 |
| Tanggal & tanggal update | `date`, `modified` | Untuk sortir "terbaru" |
| Kategori | `categories` | 3 kategori → menu/halaman kategori |
| Deskripsi + metadata film | `excerpt.rendered` | Berisi "Movie Information" (kode, aktris, studio, tag) untuk arsip JAV; deskripsi untuk konten lokal |
| Filter/pencarian | `search=`, `categories=`, `orderby=modified`, `after=` | Dukung mirror inkremental |

### 2.2 Perlu 1 permintaan per halaman video (bisa diparalelkan) — untuk player & gambar
| Data | Sumber di halaman | Coverage sampel (60 video) |
|---|---|---|
| **Embed player** | `<meta itemprop="embedURL">` → `ystream.id/e/<id>` atau `<IFRAME SRC>` → `morencius.com/embed/<id>` | **60/60 (100%)** |
| **Thumbnail** | `<meta itemprop="thumbnailUrl">` → CDN `imgswipe.org/.cc/.com` | **60/60 (100%)** |
| Durasi | `<meta itemprop="duration">` | sebagian besar |

Throughput terukur tanpa blokir: **5,5 halaman/detik dengan 5 koneksi paralel**
→ 39.434 halaman ≈ **2 jam** sekali jalan (jauh lebih cepat jika 10–20 koneksi).
Tidak ada indikasi rate-limit pada pola ini.

---

## 3. Jawaban: Apakah Bisa Membangun Web Baru dari API Ini?

### ✅ YA — secara teknis sangat memungkinkan. Ringkasannya:

1. **Katalog 100%** didapat dari 395 request REST (±8 menit) — sudah dibuktikan.
2. **Taksonomi** siap untuk menu & halaman kategori (Bokep Indo / Jilbab / JAV).
3. **Player & thumbnail** tiap video diambil dari halaman post (±2 jam dengan 5 koneksi),
   lalu di-*embed* kembali (iframe ystream/morencius) atau *hotlink* gambar imgswipe.
4. **Fitur web** standar tinggal dibangun: daftar terbaru, halaman detail, pencarian,
   filter kategori, halaman kategori, paging. Data `date/modified/categories/search`
   dari API sudah mencukupi.
5. **Sinkronisasi otomatis**: parameter `after=` + `orderby=modified` memungkinkan
   mirror harian menambah video baru tanpa menarik ulang seluruh data.

### Skema basis data yang disarankan untuk replika
```sql
CREATE TABLE videos (
  id           INTEGER PRIMARY KEY,      -- id post sumber
  judul        TEXT NOT NULL,
  slug         TEXT,
  kategori     TEXT,                     -- Bokep Indo / Bokep Jilbab / JAV Sub Indo
  tanggal      TEXT,                     -- ISO
  terakhir_update TEXT,
  deskripsi    TEXT,                     -- dari excerpt sumber
  kode_film    TEXT,                     -- mis. JUR-098 (jika ada)
  durasi       TEXT,
  thumbnail_url TEXT,                    -- hotlink CDN imgswipe
  embed_host   TEXT,                     -- ystream | morencius
  embed_id     TEXT,
  link_sumber  TEXT,                     -- permalink asli (untuk atribusi)
  scraped_at   TIMESTAMP
);
-- Sync harian: GET /wp-json/wp/v2/posts?after=<modified terakhir>&orderby=modified&order=asc
```

### Arsitektur singkat
```
[WordPress sumber]  --REST API (tanpa batas)-->  [Sync worker]  -->  [DB replika]
      |                                                        |
      +-- scrape embed/thumb per halaman (pool 5-20 koneksi) ---+
                                                                |
[Frontend web baru] <-- baca DB: daftar, kategori, pencarian, detail
       +-- embed iframe: ystream.id / morencius.com  (player tetap di host 3rd-party)
       +-- gambar: hotlink imgswipe (atau proxy CDN sendiri)
```

### Estimasi biaya/sumber daya replika
| Komponen | Upaya |
|---|---|
| Dump awal 39.434 record | ±8 menit, 1–2 MB (dengan metadata ~10 MB) |
| Scrape embed+thumbnail 39.434 halaman | ±2 jam @ 5 koneksi (tidak diblokir) |
| Penyimpanan data akhir | ±30–60 MB (tanpa menyimpan video/file) |
| Bandwidth terhadap server sumber | puluhan ribu request → beban nyata (lihat §4) |
| Frontend | tema sederhana (daftar + detail + cari); jika meniru tema KingTube tinggal replikasi tampilan |

**Catatan teknis penting**: video TIDAK perlu di-host ulang — cukup di-embed dari
ystream/morencius; thumbnail bisa hotlink dari CDN imgswipe. Itulah pola situs
sejenis ("tube/aggregator") yang selama ini dipakai.

---

## 4. Dampak Keamanan (Konteks Penilaian)

Dari sudut pandang keamanan aplikasi, "dapat membangun web baru dari API" adalah
**dampak dari F1+F2**: kurangnya kontrol akses & rate-limit pada REST API memungkinkan
**pencurian konten skala penuh (content scraping / re-hosting)** dan **hotlinking**
atas aset milik operator tanpa izin, plus pembebanan server:
- 395 request untuk daftar + ±39.434 request untuk embed/thumb = beban signifikan;
- konten premium/berlisensi (JAV: Madonna, Attackers, dsb.) bisa didistribusikan
  ulang → masalah hak cipta/legal untuk operator sumber maupun pelaku;
- statistik, iklan (JuicyAds/Histats) dan afiliasi (savetub.com) sumber dapat dikuras.

**Severity**: Tinggi. Menggabungkan F1 (API publik) + F2 (tanpa limit) + F3
(akses data/nonce tanpa batas) + F4 (username admin bocor) → replikasi penuh
terbukti dalam 8 menit.

---

## 5. Mitigasi (agar API tidak bisa dipakai membangun web tiruan)

1. **Rate limiting wajib di nginx** untuk `/wp-json/*` dan halaman post
   (`limit_req_zone` + `limit_req burst=nodelay`), balas `429`.
2. **Autentikasi/otorisasi REST**: blokir akses anonim ke listing penuh
   (endpoint posts), atau batasi `per_page` & sembunyikan `X-WP-Total` bila bukan
   untuk publik; pertimbangkan `rest_authentication_errors` → kunci anonim.
3. **Obfuskasi/pindahkan data player**: simpan embed URL bukan di HTML publik
   (dibalik endpoint ber-nonce+kapabilitas+rate-limit, atau disajikan hanya
   setelah verifikasi sesi) supaya tidak bisa di-scrape massal.
4. **Anti-scraping**: fingerprint header/UA/cookie (mis. Cloudflare), blokir IP
   dengan pola paralel, tantangan JS untuk halaman video.
5. **Hotlink protection** untuk gambar (referer check) bila gambar di-hosting sendiri;
   untuk CDN pihak ketiga koordinasikan dengan penyedia.
6. **Nonaktifkan XML-RPC & users enumeration**, kunci `wp-login`, lengkapi header
   keamanan (lihat laporan pertama: F4–F6).
7. **Monitoring**: deteksi pola crawler (request halaman video > N per menit per IP,
   akses REST tanpa cookie) → auto-ban.

---

## 6. Kesimpulan & Status Temuan

| # | Temuan | Status | Severity |
|---|---|---|---|
| F1 | REST API publik membocorkan seluruh katalog | **TERKONFIRMASI** (dump 39.434/39.434) | Tinggi |
| F2 | Tanpa rate-limit/kuota/token sama sekali | **TERKONFIRMASI** (395 req sukses 100%; 5,5 req/dtk paralel tanpa blokir) | Tinggi |
| F3 | Nonce/token anonim gratis & tanpa batas (get-post-data/post-views) | Terkonfirmasi (30/30) | Sedang–Tinggi |
| D1 | **Membangun website baru dari API = memungkinkan** | **TERBUKTI secara teknis** (dokumen ini) | Tinggi (dampak) |

Dari sisi teknis, replikasi penuh portal video sumber hanya butuh ±8 menit untuk
katalog + ±2 jam untuk data player/thumbnail, tanpa satu pun pembatasan ditemukan.

⚠️ **Catatan kepatuhan**: laporan ini menilai kelayakan & dampak keamanan.
Membangun situs yang menyalin/mendistribusikan ulang konten dewasa berlisensi
tanpa izin operator dan pemegang hak (studio JAV, kreator lokal) merupakan
pelanggaran hak cipta dan dapat melanggar hukum setempat — bukan praktik yang
disarankan. Gunakan temuan ini untuk mengamankan API, bukan untuk menyalin konten.

---

## 7. Addendum — Kebersihan Player Replika ("Tanpa Popup?")

Pengujian 5 Sep 2026, request langsung ke halaman embed (UA browser normal):

| Host embed | Hasil inspeksi | Konsekuensi bila di-embed ulang |
|---|---|---|
| ystream.id/e/<id> | HTML 1.605 byte, shell SPA "Byse Frontend" (JS `/assets/index-DocunfmE.js`). Tanpa SDK iklan terlihat di HTML statis; perilaku ditentukan JS runtime. | Perlu uji browser headless untuk memastikan. Berpotensi bersih atau ber-iklan — tidak bisa dipastikan dari curl. |
| morencius.com/embed/<id> | Memuat skrip iklan dewasa: `/ad?type=63365507802`, `ev-p2.js?type=adult&u=25486`, `adstub`, Yandex Metrika, gtag; ada `window.open` (1x) dan `eval` (1x). | **Ikut membawa iklan/popup host** ke dalam iframe player replika. |

Kesimpulan: data API (judul, kategori, deskripsi, thumbnail, tautan embed) TIDAK membawa
iklan situs sumber (JuicyAds/Histats/adstub/savetub) — halaman replika otomatis bersih
dari itu. Yang tidak dapat dikendalikan adalah isi dalam iframe milik host pihak ketiga.
Player 100% tanpa popup hanya mungkin bila memakai file video langsung (m3u8/mp4) dari
balik player host lalu di-host/diputar sendiri — itu memerlukan reverse-engineering
player/API host (domain pihak ketiga di luar target terotorisasi) dan berisiko
melanggar ToS host. Untuk replika legal, opsi aman: pakai mode embed resmi/partner
host bila tersedia, atau periksa runtime dengan browser headless (mis. di Cloud sandbox
HackerAI) sebelum memutuskan.

---

## 8. Lampiran Bukti
- `dump_api_39434_vidio.csv` — 39.434 baris penuh hasil API (7,84 MB)
- `sampel_record_lengkap.csv` — 30 video lengkap: judul, kategori, tanggal, deskripsi,
  thumbnail, embed URL, durasi, link sumber
- `dump_all_api.py` — skrip dump (resume-able, dapat dipakai ulang/verifikasi)
- `ystream.html` / `morencius.html` — hasil inspeksi halaman embed (Addendum §7)


