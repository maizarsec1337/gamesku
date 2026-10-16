# Laporan Rekognisi API & Arah Data — otakudesu.com.mx

**Tanggal pengujian:** 2026-09-05 (waktu server: `date: Sat, 05 Sep 2026`)
**Metode:** HTTP probing terbatas dari Termux (`curl`), tanpa autentikasi, tanpa request destruktif.
**Ringkasan:** Situs ini adalah **klon bajakan anime berbasis WordPress** di belakang Cloudflare. Seluruh backend datanya (katalog anime = 229 kategori / 227 seri asli, 2.440 episode, penulis, genre) dapat diambil **tanpa autentikasi, tanpa API key, tanpa rate-limit sisi aplikasi**, lewat REST API WordPress dan endpoint admin-ajax internal yang bocor. Data lengkap per anime (judul + gambar poster + daftar semua episode dengan tanggal & link) sudah diagregasi ke file `data_anime_lengkap.json` (227 seri / 2.326 eps).

---

## 1. Identitas & Infrastruktur

| Item | Temuan |
|---|---|
| Platform | WordPress (versi inti tidak terekspos langsung; plugin **Yoast SEO 28.3** bocor via REST `types`) |
| Tema | `animestream` v2.1.4 (tema kustom bajakan; player internal "Ani Stream") |
| Cache | LiteSpeed Cache 7.9 (bocor lewat komentar HTML `<!-- Page supported by LiteSpeed Cache 7.9 ... -->`) |
| CDN/proxy | Cloudflare — A: `104.21.60.29`, `172.67.190.248`; NS: `otto.ns.cloudflare.com`, `peaches.ns.cloudflare.com`; HTTP/2 & HTTP/3 |
| Image CDN | Jetpack Photon (`i0.wp.com`, `i1.wp.com`) |
| Analitik | Google Analytics `G-6C0LN0KJZN`, `G-RZ9FXE3DWK` |
| Plugin integrasi | `remote-post/v1` (remote posting), `softmux/v1` (dashboard embed player), `wp-abilities/v1`, `batch/v1` |
| Bahasa/lokasi | Indonesia (`id_ID`) |
| Disclaimer situs | "does not store any files... provided by third parties" (pola khas klon) |

`robots.txt` berisi blok `wp-json` **hanya sebagai notasi** (tidak ada efek teknis — REST tetap terbuka penuh).

---

## 2. Ukuran Katalog (data nyata, dihitung dari respons server)

| Dataset | Jumlah | Sumber |
|---|---|---|
| Episode (post) | **2.440** | `X-WP-Total` header REST + sitemap post-1 (2.000) + post-2 (440) |
| Seri anime (CPT `anime`) | **229** halaman (1 slug aneh `6897`) | `wp-sitemap-posts-anime-1.xml` |
| Seri anime asli via REST kategori | **227** (229 kategori − 2 kategori default non-anime) → `data_anime_lengkap.json` (judul+gambar+semua eps) | `wp-json/wp/v2/categories` + `posts?categories=<ID>` |
| Penulis/User | 1 (`timothy`, ID 3) | `wp-json/wp/v2/users` + sitemap users |
| Halaman statis | 5 | `wp-sitemap-posts-page-1.xml` |
| Taksonomi | `category`, `genres` (30+), `season` | sitemap + arsip `/genres/...` |

Episode baru masuk **otomatis harian** — contoh 3 post pada `2026-09-05T03:04Z` (One Piece #1179 id 8307, dll). Pola batch pagi mengindikasikan sinkronisasi terjadwal dari sumber hulu.

---

## 3. "API Tanpa Batas" — Endpoint Publik yang Menyajikan Semua Anime

### 3.1 REST API WordPress inti — endpoint dump utama
Semua episode bisa ditarik **100 item/halaman × 2.440 halaman** tanpa auth:

```
GET https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=100&page=1&_fields=id,date,link,title
```

Bukti respons (header, `per_page=1`):
```
HTTP/2 200
x-wp-total: 2440
x-wp-totalpages: 2440
access-control-expose-headers: X-WP-Total, X-WP-TotalPages, Link
```

Fitur bebas yang tersedia: `search`, `after`/`before`, `orderby`, `offset`, `page`, `per_page` (s.d. 100), `_fields`, `_embed`. Tidak ada nonce, cookie, atau kunci API yang diminta. Contoh data nyata:

```json
{"id":8307,"date":"2026-09-05T03:04:45",
 "link":"https://otakudesu.com.mx/one-piece-episode-1179-sub-indo/",
 "title":{"rendered":"One Piece Episode 1179 Sub Indo"}}
```

Catatan: field `content` hanya teks SEO (deskripsi), **bukan** markup player. Embed/hash ada di meta tersembunyi per post → hanya muncul di HTML halaman episode (lihat §4).

### 3.2 Pencarian global REST
```
GET /wp-json/wp/v2/search?search=<kata>&per_page=100
```

### 3.3 Endpoint JSON internal (admin-ajax) — bocor tanpa nonce
Autocomplete pencarian situs ternyata API JSON publik. **Tanpa nonce/kapabilitas**, keyword apa pun (bahkan kosong) diterima:

```
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=ts_ac_do_search&keyword=naruto
```

Respons JSON berisi per anime: `ID`, `post_image`, `post_title`, `post_genres`, `post_type` (HD), `post_link`, `post_latest`, dll. Bisa di-loop untuk menambang seluruh katalog judul+slug+genre.

### 3.4 API player (embed) — tanpa auth
```
POST /wp-admin/admin-ajax.php
action=as_load_player&hash=<base64 dari data-video>

→ 200 OK: <iframe src="https://ani.tellygossips.site/embed/v75wpf4" ...></iframe>
```
Hash diambil dari `data-video` di div `.as-post-video` pada HTML tiap episode. Untuk memirror penuh situs: crawl halaman episode (atau REST untuk daftar URL) → parse hash → panggil endpoint ini per episode.

### 3.5 Sitemap = indeks crawl penuh
`https://otakudesu.com.mx/wp-sitemap.xml` berisi: `posts-anime-1` (229 seri), `posts-post-1/2` (2.440 episode), `posts-page-1`, `taxonomies-genres-1`, `taxonomies-season-1`, `taxonomies-category-1`, `users-1`. Semua URL bersih & bisa diambil utuh (tidak dipaginasi).

### 3.6 User enumeration
```
GET /wp-json/wp/v2/users?per_page=100   → [{"id":3,"slug":"timothy","name":"Timothy Tgo"}]
GET /wp-sitemap-users-1.xml             → /author/timothy/
```

### Ringkasan "arah" data katalog
Seluruh data (judul seri + episode + genre + jadwal) tersimpan di **database WordPress lokal situs ini** dan dilayani oleh API di atas. Tidak ada pagination maksimum dari sisi aplikasi; satu-satunya pembatas teoritis adalah throttle IP Cloudflare.

---

## 4. Arah Data Video / Embed (rantai hulu)

Hasil penelusuran berurutan per episode (contoh One Piece #1179):

1. Halaman episode (HTML, non-cache): div player
   ```html
   <div class="as-post-video" data-video="SzFWUnQxaUJ4SmdIVGtFdzhlYVF2Vys1MXZKMThYSVE5UWx5bHdUY2tjdGhPbnVobXcxSjhPN2NYOWZFblJ4WQ==">...
   ```
   + `<select class="mirror">` berisi **beberapa server mirror** (nilai = HTML base64 berisi hash berbeda).
2. POST `as_load_player&hash=...` → iframe embed farm:
   - Server default: **`ani.tellygossips.site/embed/v75wpf4`** → A `103.224.212.216` (Apache)
   - Mirror: **`embed.animehi.co/embed/v76jcbc`** → Cloudflare `172.67.173.68`
3. Embed farm itulah yang menyimpan/menyajikan file video sebenarnya (video tidak pernah ada di server otakudesu.com.mx).

Status validasi hop ke-3 (dari embed farm ke file video mentah):
- `embed.animehi.co` → `403` untuk permintaan non-browser (anti-hotlink/anti-bot; butuh validasi via browser/agent).
- `ani.tellygossips.site` → respons `200/206` tetapi isi body pendek (1.020 byte) mengarah ke aset domain-parking (`assets.abovedomains.com`) — kemungkinan player sebenarnya dimuat via JS/referer; **perlu validasi browser**.
- **Tidak diverifikasi:** IP origin sebenarnya di balik Cloudflare; bisa dicoba via Certificate Transparency / teknik bypass proxy (di luar cakupan sesi ini, tanpa izin eksplisit lebih lanjut).

**Kesimpulan arah data:**
```
[hulu konten bajakan → farm embed: embed.animehi.co / ani.tellygossips.site]
        → iframe ke halaman episode otakudesu.com.mx (hash base64 di meta post)
        → player "Ani Stream" (tema animestream) via admin-ajax as_load_player
        → API REST publik (metadata episode) + sitemap (daftar URL) + ts_ac_do_search (JSON judul)
```
Konten episode masuk ke situs ini lewat alur remote-posting (namespace REST `remote-post/v1/create`) dan embed ditambahkan via plugin dashboard "Softmux" (`softmux/v1/add-embed`, `add-embed-dashboard`, `touch-series`) — keduanya diasumsikan butuh sesi admin; **tidak diuji** karena bersifat memodifikasi data (perlu otorisasi eksplisit sebelum diuji).

---

## 5. Permukaan "Celah" yang Dapat Dipakai untuk Melemahkan/Blokir

| # | Temuan | Dampak | Status |
|---|---|---|---|
| 1 | REST `/wp-json/wp/v2/*` terbuka penuh tanpa auth (2.440 episode, search, users) | Kloning data total, scraping massal tak terbatas, user enum | **Terkonfirmasi** |
| 2 | `ts_ac_do_search` (admin-ajax) tanpa nonce | API JSON internal bocor untuk menambang seluruh judul+slug | **Terkonfirmasi** |
| 3 | `as_load_player` tanpa auth | API player dapat dipanggil massal (beban + abuse) | **Terkonfirmasi** |
| 4 | `remote-post/v1/create`, `softmux/v1/add-embed*` tanpa skema argumen publik | Potensi membuat post/menambah embed bila cek kapabilitas lemah | **Perlu validasi (butuh sesi/izin; tidak diuji)** |
| 5 | Yoast 28.3, LiteSpeed 7.9, versi tema, nama plugin bocor | Fingerprinting untuk CVE plugin/versi | **Terkonfirmasi** (disclosure) |
| 6 | User tunggal `timothy` (ID 3) via REST + sitemap | Serangan brute/password-spray target user | **Terkonfirmasi** |

### Rekomendasi blokir/penegakan (untuk pemutus akses)
1. **Blokir rantai embed** (paling efektif mematikan fungsi nonton): `embed.animehi.co`, `ani.tellygossips.site` + IP `103.224.212.216`, `172.67.173.68`, dan mirror yang muncul pada episode lain.
2. **Laporkan penyalahgunaan ke Cloudflare** (proxy di depan situs): abuse.cloudflare.com — sertakan bukti §3–§4; Cloudflare dapat mengungkap/melepas origin bila melanggar kebijakan DMCA berulang.
3. **DMCA/abuse ke registrar/registry .mx** (domain .mx di bawah registry NIC México) serta hosting origin (bila origin IP ditemukan via CT-log/teknik lain).
4. **Blokir domain utama** `otakudesu.com.mx` + pola klon sejenis (tema animestream, namespace REST `remote-post/v1`/`softmux/v1` sebagai signature deteksi).
5. Blokir image-proxy Jetpack `i0.wp.com/otakudesu.com.mx/*` bila ingin menurunkan kualitas tampilan tanpa menyentuh domain utama.
6. Signature deteksi WAF/IDS: pola `action=as_load_player`, `action=ts_ac_do_search`, `data-video=` (hash base64), iframe `embed.animehi.co`.

---

## 6. Perintah Reproduksi (curl)

```bash
UA="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36"

# Total episode + halaman
curl -sI -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=1" | grep -i x-wp-total

# Ambil seluruh episode (2.440) - contoh halaman 1
curl -s -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=100&page=1&_fields=id,date,link,title"

# Pencarian internal (JSON anime)
curl -s -A "$UA" -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  --data "action=ts_ac_do_search&keyword=naruto" \
  https://otakudesu.com.mx/wp-admin/admin-ajax.php

# Player (hash diambil dari data-video di halaman episode)
curl -s -A "$UA" -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "action=as_load_player" --data-urlencode "hash=<HASH>" \
  https://otakudesu.com.mx/wp-admin/admin-ajax.php

# User enum + sitemap
curl -s -A "$UA" "https://otakudesu.com.mx/wp-json/wp/v2/users?per_page=100"
curl -s -A "$UA" "https://otakudesu.com.mx/wp-sitemap-posts-anime-1.xml" | grep -o "<url>" | wc -l
```

---

## 7. Batasan & Catatan Etika-Teknis
- Pengujian dibatasi probing GET/POST read-only; **tidak ada** request yang mengubah data (`remote-post/v1/create`, `softmux/v1/*` hanya didokumentasikan, tidak dieksekusi).
- Hop terakhir (embed farm → file video) membutuhkan browser/agent (anti-bot 403) — ditandai *needs-validation*.
- Origin IP di balik Cloudflare belum diidentifikasi.
- Situs adalah properti pihak ketiga yang diduga melanggar hak cipta; seluruh pengujian diasumsikan berjalan dengan otorisasi dari pemegang kepentingan yang sah.


