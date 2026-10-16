# API TANPA BATAS — otakudesu.com.mx

**Status semua endpoint di bawah: TANPA BATAS** = tanpa autentikasi, tanpa API key, tanpa nonce, tanpa rate-limit sisi aplikasi, pagination bebas sampai data habis.
**Tanggal uji:** 2026-09-05 | **Total data REST:** 2.440 episode (global) + 229 kategori | **Hasil agregasi:** 227 seri anime asli / 2.326 episode dengan judul+gambar+daftar eps → file `data_anime_lengkap.json` | **Satu-satunya pembatas teoritis:** throttle IP Cloudflare.

> Cara pakai dokumen ini: pilih API → jalankan curl → hasilnya akan "menunjuk" ke data/endpoint berikutnya (lihat kolom **Arah lanjut**) → telusuri sendiri sampai hulu.

---

## A. API REST — Metadata & Daftar (arahnya ke halaman episode)

### A1. SEMUA EPISODE (dump penuh tanpa batas)
```
GET https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=100&page=N
```
| Parameter | Nilai | Batas |
|---|---|---|
| `page` | 1 s.d. 2440 | **Tanpa batas** (total pages = 2440) |
| `per_page` | s.d. 100 | dibatasi WP (maks 100) |
| `search` / `after` / `before` / `orderby` / `offset` | bebas | tanpa batas |

Bukti: `x-wp-total: 2440`, `x-wp-totalpages: 2440`, HTTP 200 tanpa cookie/auth.
Contoh respon: `{"id":8307,"date":"2026-09-05T03:04:45","link":"https://otakudesu.com.mx/one-piece-episode-1179-sub-indo/","title":{"rendered":"One Piece Episode 1179 Sub Indo"}}`
**Arah lanjut:** kolom `link` → halaman episode (pakai A5 untuk ambil hash player-nya).

### A1b. SEMUA SERI (kategori) → daftar episode PER ANIME — "API all-anime" yang sebenarnya
**Konsep:** di situs ini **1 seri anime = 1 kategori WP**. Maka: `categories` = katalog anime lengkap, dan `posts?categories=<ID>` = semua episode seri itu. Dua endpoint ini menggantikan kebutuhan halaman seri (yang memang tidak memuat daftar episode).

```
# 1) Daftar semua anime (nama seri + slug + jumlah eps + tautan seri)
GET https://otakudesu.com.mx/wp-json/wp/v2/categories?per_page=100&page=N
#    header: x-wp-total: 229  → 3 permintaan saja untuk seluruh katalog
#    → [{"id":153,"name":"One Piece","slug":"one-piece","count":92,"link":"https://otakudesu.com.mx/anime/one-piece/"}, ...]

# 2) Semua episode satu anime (pagination bebas sampai habis)
GET https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=<ID>&per_page=100&page=N
#    contoh: categories=153 (One Piece) → 92 post: eps 1–100 (batch 2026-08-20) + eps 1155–1179 (rilis mingguan)
```
Catatan kelengkapan:
- 227 dari 229 kategori = seri anime asli. 2 sisanya = kategori default non-anime: `Watch Anime Online` (id 56, 152 post) dan `Watch Anime Online with SUB and DUB Full HD` (id 1, 52 post) — bak sampah impor; 90 post di antaranya juga menempel ke seri aslinya, 114 post lainnya "yatim" (hanya ada di kategori sampah, tetap terlihat lewat dump global A1).
- Tanggal posting ≠ tanggal rilis anime: OP memuat eps 1–100 yang diposting serentak 2026-08-20 (backfill).
- File agregat lengkap (judul + gambar poster + tiap eps {no, judul, tanggal, link}): `data_anime_lengkap.json` (227 seri / 2.326 eps), daftar ringkas: `daftar_seri.txt`.
**Arah lanjut:** kolom `link` tiap episode → A5 → B2 → C.

### A2. PENCARIAN GLOBAL
```
GET https://otakudesu.com.mx/wp-json/wp/v2/search?search=KATA&per_page=100
```
**Arah lanjut:** hasil berisi URL → ke halaman episode/seri.

### A3. USER ENUMERATION
```
GET https://otakudesu.com.mx/wp-json/wp/v2/users?per_page=100
→ [{"id":3,"slug":"timothy","name":"Timothy Tgo"}]
```

### A4. INFO SISTEM (namespace & route REST, versi plugin bocor)
```
GET https://otakudesu.com.mx/wp-json/
→ namespace: oembed/1.0, remote-post/v1, litespeed/v1/v3, yoast/v1, softmux/v1, wp/v2, batch/v1, wp-abilities/v1
→ indikasi plugin: Yoast SEO 28.3, LiteSpeed Cache 7.9, tema animestream 2.1.4
```
**Arah lanjut:** namespace `softmux/v1`, `remote-post/v1` = jejak plugin impor/embed → kandidat endpoint hulu (lihat E).

### A5. AMBIL SATU EPISODE (untuk mengambil hash player)
```
GET https://otakudesu.com.mx/<slug-episode>/
# contoh: /one-piece-episode-1179-sub-indo/
```
Ekstrak hash:
```bash
curl -s -A "Mozilla/5.0" "https://otakudesu.com.mx/one-piece-episode-1179-sub-indo/" \
 | grep -o 'data-video="[^"]*"' | head -1
# → data-video="SzFWUnQxaUJ4SmdIVGtFdzhlYVF2Vys1MXZKMThYSVE5UWx5bHdUY2tjdGhPbnVobXcxSjhPN2NYOWZFblJ4WQ=="
```
HTML juga memuat `<select class="mirror">` berisi server cadangan — nilai option = HTML **base64** yang di dalamnya ada hash data-video lain. Decode: `echo "NILAI_OPTION" | base64 -d`
**Arah lanjut:** hash → API B2.

---

## B. API AJAX — Jembatan ke Embed (arahnya ke farm video)

### B1. PENCARIAN ANIME — JSON internal, TANPA nonce
```
POST https://otakudesu.com.mx/wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=ts_ac_do_search&keyword=KATA   ← keyword kosong juga diterima
```
Respons JSON per anime: `ID`, `post_image`, `post_title`, `post_genres`, `post_type` (HD), `post_link`, `post_latest`.
**Arah lanjut:** `post_link` → halaman seri/episode.

### B2. API PLAYER — TANPA auth (INILAH KUNCI ARAH VIDEO)
```
POST https://otakudesu.com.mx/wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=as_load_player&hash=<HASH_DARI_A5>
```
Respons nyata:
```html
<iframe src="https://ani.tellygossips.site/embed/v75wpf4" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" style="width:100%;height:100%;"></iframe>
```
Hash berbeda → host embed berbeda (uji semua hash dari `<select class="mirror">`). Contoh hasil uji hash kedua:
```html
<iframe src="https://embed.animehi.co/embed/v76jcbc" ...></iframe>
```
**Arah lanjut:** host embed = pemegang file video (lihat C).

---

## C. HOST EMBED — "arah" yang sudah terbukti

| Host embed | Dari API | IP | Server |
|---|---|---|---|
| `ani.tellygossips.site` | B2 hash utama | `103.224.212.216` | Apache |
| `embed.animehi.co` | B2 hash mirror | `172.67.173.68` | Cloudflare |

```
GET https://ani.tellygossips.site/embed/v75wpf4     → HTTP 200/206
GET https://embed.animehi.co/embed/v76jcbc          → HTTP 403 (anti-bot, butuh browser + referer)
```
**Telusuri sendiri lebih dalam** (mendapatkan URL video .m3u8/.mp4 dari embed):
```bash
# 1. minta dengan referer + UA browser (mungkin butuh 2-step cookie)
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
     -e "https://otakudesu.com.mx/" \
     "https://embed.animehi.co/embed/v76jcbc" -o embed.html
# 2. cari sumber video mentah
grep -oE 'https?://[^"'"'"' ]+\.(m3u8|mp4)[^"'"'"' ]*' embed.html
# 3. resolve & lihat header server video
curl -sI "https://<host-dari-hasil>/path/file.m3u8"
```

---

## D. SITEMAP = INDEKS CRAWL PENUH (tanpa batas)

| URL | Isi |
|---|---|
| `GET /wp-sitemap.xml` | indeks utama |
| `GET /wp-sitemap-posts-anime-1.xml` | 229 seri anime (1 slug aneh: `6897`) |
| `GET /wp-sitemap-posts-post-1.xml` | 2.000 episode |
| `GET /wp-sitemap-posts-post-2.xml` | 440 episode |
| `GET /wp-sitemap-users-1.xml` | author `timothy` |
| `GET /wp-sitemap-taxonomies-genres-1.xml` | genre |
| `GET /wp-sitemap-taxonomies-season-1.xml` | season |

Semua URL utuh (tidak dipaginasi). **Arah lanjut:** URL → A5 → B2 → C.

---

## E. ENDPOINT HULU YANG BELUM DIUJI (bersifat MENULIS / butuh otorisasi eksplisit)
Ini jejak plugin pengisi konten — kalau kamu mau lihat "arah" siapa yang memasok data, pelajari endpoint ini (JANGAN di-POST tanpa izin, karena membuat/mengubah data):

| Endpoint | Fungsi | Jejak |
|---|---|---|
| `POST /wp-json/remote-post/v1/create` | Membuat post dari remote | alur impor episode |
| `POST /wp-json/softmux/v1/add-embed` | Tambah embed player | plugin Softmux |
| `POST /wp-json/softmux/v1/add-embed-dashboard` | Tambah embed dari dashboard | plugin Softmux |
| `POST /wp-json/softmux/v1/touch-series` | Update seri | plugin Softmux |

---

## F. DIAGRAM ARAH (untuk penelusuranmu sendiri)
```
[1] wp-sitemap*.xml ──► daftar URL episode/seri
[2] REST wp/v2/posts ─► 2.440 link episode (A1)
        │
        ▼
[A5] GET halaman episode → data-video HASH  (+ select.mirror → hash cadangan)
        │
        ▼
[B2] POST as_load_player&hash=HASH
        │
        ▼
[embed farm] embed.animehi.co | ani.tellygossips.site   ← PEMEGANG FILE VIDEO
        │  (butuh browser/referer untuk tembus 403)
        ▼
[URL video mentah .m3u8/.mp4]  ← hulu terakhir (belum diverifikasi, perlu browser)
```
Titik yang belum terverifikasi = hop terakhir (embed farm → file video) karena anti-bot 403; butuh agent/browser.

---

## REPRODUKSI CEPAT (copy-paste)
```bash
UA="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36"

# A1 cek total + halaman 1
curl -sI -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=1" | grep -i x-wp-total
curl -s -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=100&page=1&_fields=id,date,link,title"

# A1b katalog anime (kategori) + episode satu seri
curl -s -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/categories?per_page=100&page=1&_fields=id,name,slug,count,link"
curl -s -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=153&per_page=100&_fields=id,date,link,title"   # One Piece

# B1 pencarian internal
curl -s -A "$UA" -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  --data "action=ts_ac_do_search&keyword=naruto" \
  https://otakudesu.com.mx/wp-admin/admin-ajax.php

# A5 ambil hash
curl -s -A "$UA" "https://otakudesu.com.mx/one-piece-episode-1179-sub-indo/" \
 | grep -o 'data-video="[^"]*"' | head -1

# B2 player → arah embed
curl -s -A "$UA" -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "action=as_load_player" --data-urlencode "hash=HASH_ANDA" \
  https://otakudesu.com.mx/wp-admin/admin-ajax.php
```

Laporan analisis penuh: `LAPORAN_otakudesu.com.mx.md`



