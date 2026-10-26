# Backend Gameku

Backend aktif memakai Node.js, Express, Prisma 7, dan PostgreSQL. Kode PHP lama sudah dipindahkan ke arsip lokal di luar project; data lama, schema SQL, upload, dan log tetap dipertahankan sampai transfer data diverifikasi.

## Menjalankan lokal

Gunakan Node.js 20.19 atau lebih baru. Salin `.env.example` menjadi `.env`, lalu isi konfigurasi database lokal/dev secara aman. Jangan kirim kredensial lewat chat atau commit file `.env`.

```powershell
npm ci
npm run build
npm run db:validate
npm test
npm start
```

API tersedia di port 8000 (`/api/sehat`). Jalankan frontend dari folder `frontend`; Vite meneruskan `/api` dan `/uploads` ke Express.

## Dokumen operasional

- [Panduan deploy](DEPLOYMENT.md)
- [Detail migrasi, transfer data, dan rollback](EXPRESS-MIGRATION.md)
- `.env.example` berisi daftar variabel backend. URL database dan storage hanya untuk backend.

Jangan jalankan transfer terhadap database production sebagai tes. Proses transfer membutuhkan database Supabase dev/preview yang terisolasi serta backup database sumber yang hash-nya sudah diverifikasi.
