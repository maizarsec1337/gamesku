# Deployment backend Express

Panduan PHP sebelumnya sudah dipensiunkan. Ikuti dokumen ini untuk API aktif Node.js + Express; detail variabel dan langkah operasional lengkap ada di [EXPRESS-MIGRATION.md](EXPRESS-MIGRATION.md).

## Environment

- `DATABASE_URL`: Supabase pooler untuk runtime API.
- `DIRECT_URL`: koneksi langsung atau session pooler khusus migrasi Prisma.
- `SESSION_SECRET`: rahasia backend dengan panjang minimal 32 karakter.
- `ALLOWED_ORIGINS` dan `APP_ORIGIN`: origin frontend yang diizinkan.
- `S3_*`: object storage permanen untuk upload production.
- `VITE_API_BASE_URL` hanya berisi origin API publik dan diatur di project frontend; jangan letakkan kredensial database di frontend.

Gunakan environment dan project database terpisah untuk development, preview, dan production. Terapkan migration hanya setelah SQL ditinjau dan backup database target diverifikasi.

## Vercel dan file upload

Vercel dapat menjalankan API Express melalui konfigurasi `backend/vercel.json`. Function tidak menyediakan disk upload permanen, sehingga production harus menggunakan object storage S3-compatible. Paket Hobby Vercel terbatas untuk penggunaan personal/nonkomersial; gunakan hosting yang sesuai untuk toko komersial.

## Pemeriksaan sebelum rilis

1. `npm ci`, `npm run build`, `npm run db:validate`, dan `npm test`.
2. Terapkan migration ke database Supabase dev/preview yang kosong dan terisolasi.
3. Jalankan transfer dengan backup sumber terverifikasi, lalu bandingkan record dan relasi.
4. Uji login, otorisasi role, CRUD, checkout, pembayaran manual, dan upload menggunakan sandbox.
5. Pertahankan backup dan data lama sampai penerimaan migrasi disetujui.

Rollback kode tidak membalikkan write yang sudah masuk ke database baru. Rencanakan rekonsiliasi transaksi sebelum beralih kembali.
