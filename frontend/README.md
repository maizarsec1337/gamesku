# Frontend Gamesku (React + Vite)

Marketplace Gamesku — mobile-first (shell 430px), React 19 + React Router 7 + Vite.
API aktif dijalankan oleh Node.js + Express di `../backend`; frontend ini tidak memanggil PHP.

## Struktur

```text
frontend/
  public/     Aset statis (favicon, dll)
  src/
    halaman/        Halaman toko (/store, /keranjang, /masuk, ...)
    halaman-admin/  Dashboard admin (/admin/...)
    komponen/       Komponen toko + admin
    konteks/        State global (keranjang, wishlist, admin, pesanan)
    layanan/        Lapisan data (fetch ke API Express `/api/*`)
    data/           Konstanta nilai (tanpa data contoh)
    css/            Style aktif (hanya yang diimpor)
    utilitas/       Format, hitung, validasi
  scripts/    Skrip dev (uji visual Playwright)
```

## Menjalankan lokal

```bash
cd frontend
npm install
npm run dev
```

Backend Node.js + Express (folder `../backend`) jalan di `http://localhost:8000`
— request `/api` otomatis diproxy oleh Vite.

## Skrip

- `npm run dev` — dev server (port 5173)
- `npm run build` — build produksi
- `npm run lint` — lint (oxlint)
- `npm run uji-visual` — uji visual Playwright (butuh Chrome + build preview)

Source PHP untuk rollback disimpan di arsip lokal di luar project; data dan schema lama tetap dipertahankan sampai transfer terverifikasi. Untuk menjalankan API aktif, ikuti `../backend/README.md`.
