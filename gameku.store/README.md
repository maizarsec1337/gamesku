# Gamesku

Monorepo marketplace Gamesku — frontend React + backend PHP.

```text
gamesku.store/
  frontend/   React 19 + Vite (lihat frontend/README.md)
  backend/    API PHP (lihat backend/README.md)
```

## Menjalankan lokal

```bash
# Terminal 1 — backend PHP
php -S localhost:8000 -t backend

# Terminal 2 — frontend Vite
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Request `/api` dari frontend
diteruskan otomatis ke backend PHP di port 8000.

## Build produksi terpadu (satu folder deployment)

```bash
cd frontend
npm run build
```

Perintah itu menjalankan `vite build` (output langsung ke `../dist/`)
lalu `node scripts/kemas-backend.mjs` yang menyalin backend PHP
(`api/`, `src/`, `config/config.php`, `database/*.sql` + `instal.php`,
`uploads/` kosong) ke folder yang sama. Hasilnya **satu paket**
`gameku.store/dist/` siap diunggah ke hosting PHP + MySQL:

```text
dist/
  index.html + assets/ + favicon.svg   (frontend hasil build)
  api/index.php + src/                 (backend PHP)
  config/config.php                    (SATU config — isi kredensial hosting)
  database/                            (skema + instal.php)
  uploads/                             (folder tulis + .htaccess anti-eksekusi)
  .htaccess                            (router /api/* + SPA fallback + proteksi)
```

Catatan: `config/config.php` tidak di-commit (lihat `.gitignore`).
Di hosting, salin `backend/config/contoh.config.php` menjadi dasar isi
`dist/config/config.php` lalu sesuaikan kredensial MySQL hosting.
