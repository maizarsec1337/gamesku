# Gamesku

Monorepo marketplace Gamesku — frontend React + backend PHP.

```text
gameku.store/
  frontend/   React 19 + Vite (lihat gameku.store/frontend/README.md)
  backend/    API PHP (lihat gameku.store/backend/README.md)
```

## Menjalankan lokal

```bash
# Terminal 1 — backend PHP
python php_runtime.py

# Terminal 2 — frontend Vite
cd gameku.store/frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Request `/api` dari frontend
diteruskan otomatis ke backend PHP di port 8000.

Di Windows, `mulai.bat` menjalankan keduanya. Launcher mengaktifkan ekstensi PHP
yang tersedia (termasuk `pdo_mysql`) tanpa mengubah `php.ini` global.
Menjalankan Vite saja tidak menjalankan backend PHP.

Streamku membaca katalog asli dari `gameku.store/backend/api/data_anime_lengkap.json` melalui
`/api/anime`. Produk membaca MySQL sesuai `gameku.store/backend/config/config.php`.
Periksa `/api/sehat`: `database` harus bernilai `tersambung` untuk katalog produk.
Jika memakai MySQL InfinityFree gratis, backend PHP harus berjalan di hosting
yang sama; koneksi langsung dari komputer lokal tidak didukung. Gunakan MySQL
lokal dengan salinan data sendiri untuk pengembangan, atau backend aktif melalui
variabel `API_PROXY` sebelum menjalankan Vite. Jangan mengganti hostname dengan
tebakan atau memasukkan kredensial database ke frontend.

## Build produksi terpadu (satu folder deployment)

```bash
cd gameku.store/frontend
npm run build
```

Perintah itu menjalankan `vite build` (output langsung ke `../dist/`)
lalu `node scripts/kemas-backend.mjs` yang menyalin backend PHP
(`api/`, `src/`, `config/config.php`, `database/*.sql` + `instal.php`,
`uploads/` kosong) ke folder yang sama. Hasilnya **satu paket**
`gameku.store/dist/` siap diunggah ke hosting PHP + MySQL:

```text
gameku.store/dist/
  index.html + assets/ + favicon.svg   (frontend hasil build)
  api/index.php + src/                 (backend PHP)
  config/config.php                    (SATU config — isi kredensial hosting)
  database/                            (skema + instal.php)
  uploads/                             (folder tulis + .htaccess anti-eksekusi)
  .htaccess                            (router /api/* + SPA fallback + proteksi)
```

Catatan: `config/config.php` tidak di-commit (lihat `.gitignore`).
Di hosting, salin `gameku.store/backend/config/contoh.config.php` menjadi dasar isi
`gameku.store/dist/config/config.php` lalu sesuaikan kredensial MySQL hosting.

## Pengujian

Di `gameku.store/frontend/`, jalankan `npm test` dan `npm run lint`. Setelah server Vite
berjalan, jalankan `npm run uji-regresi` dan `npm run uji-pembeli` untuk
pengujian browser dengan fixture API. Gunakan `GAMEKU_TEST_BROWSER` untuk
menentukan executable browser bila Playwright belum memiliki browser.

Di `gameku.store/backend/`, jalankan `npm test`. Isi `GAMEKU_TEST_BASE` dengan URL server
PHP yang berjalan untuk menyertakan smoke HTTP. Pengujian terisolasi tidak
memerlukan MySQL dan tidak menggantikan pengujian transaksi database nyata.

Lihat [hasil audit lanjutan](docs/audit_lanjutan_2026-10-22.md) untuk daftar
perbaikan dan batas verifikasi.
