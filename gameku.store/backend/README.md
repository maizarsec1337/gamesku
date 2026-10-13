# Backend gamesku.store (PHP + MySQL)

API PHP untuk **gamesku.store**. Frontend (React + Vite di `../frontend`)
meneruskan semua request `/api` ke backend ini (lihat `frontend/vite.config.js`,
proxy target default `http://localhost:8000`).

Backend memakai pola **front-controller**: satu berkas `api/index.php` menjadi
router, lalu meneruskan ke kelas pengendali di `src/Pengendali/`. Basis data
MySQL diakses lewat **PDO** dengan *prepared statement* (aman dari SQL injection).

## Struktur

```text
backend/
  api/
    index.php          Front-controller / router untuk semua /api/*
  config/
    config.php         Konfigurasi lokal (DB, CORS, uploads) — jangan di-commit
    contoh.config.php  Contoh konfigurasi
  database/
    skema.sql          Skema lengkap (10 tabel)
    instal.php         Installer: buat DB + tabel + admin default
  src/
    Bantu.php          Helper: JSON, input, slug, format, id/nomor pesanan
    Database.php       Koneksi PDO + helper query & transaksi
    Auth.php           Sesi admin + password_hash/password_verify
    Aktivitas.php      Pencatat audit log
    bootstrap.php      Autoload, CORS, sesi, handler error
    Pengendali/        Satu kelas per sumber daya (Auth, Produk, Pesanan, ...)
  uploads/             Berkas unggahan (diabaikan git)
```

## Menjalankan lokal

Backend adalah *router script*, jadi jalankan dari folder `backend`:

```bash
php -S localhost:8000 -t . api/index.php
```

> Penting: `-t .` + `api/index.php` (bukan `-t backend` saja). Router dipakai agar
> path bersih seperti `/api/produk` dan `/api/produk/{id}` bekerja, sekaligus
> tetap menyajikan berkas statis di `uploads/`.

Cek kesehatan:

```text
http://localhost:8000/api/sehat
```

Respons sukses: `{ "ok": true, "data": { "layanan": "gameku-store", "database": "tersambung", ... }, "pesan": "" }`

## Menyiapkan basis data

1. Buat konfigurasi lokal (salin contoh lalu sesuaikan kredensial):

   ```bash
   cp config/contoh.config.php config/config.php
   ```

2. Jalankan installer (membuat database, tabel, dan satu akun admin default):

   ```bash
   php database/instal.php
   # kustom: php database/instal.php --pengguna=admin --sandi=rahasia123
   ```

   Atau impor skema manual lewat klien MySQL:

   ```bash
   mysql -u root -p < database/skema.sql
   ```

   > Toko dimulai **kosong** (0 produk, 0 pesanan, 0 pelanggan). Hanya ada satu
   > akun `admin` untuk masuk ke dasbor — tidak ada data contoh yang dikarang.

## Endpoint

Semua respons berbentuk `{ ok, data?, pesan }`. Endpoint bertanda **(admin)**
menuntut sesi admin (kuki `PHPSESSID` setelah `POST /api/auth/masuk`).

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/api/sehat` | Cek kesehatan + status DB |
| POST | `/api/auth/masuk` | Masuk admin `{ pengguna, sandi }` |
| POST | `/api/auth/keluar` | Keluar sesi |
| GET | `/api/auth/saya` | Data sesi admin saat ini |
| POST | `/api/auth/daftar` | (admin) tambah admin baru |
| GET | `/api/dasbor` | (admin) statistik, grafik, produk terlaris |
| GET | `/api/kategori` | Daftar kategori (tamu: hanya Aktif) |
| GET/POST/PUT/DELETE | `/api/kategori[/{id}]` | (tulis: admin) CRUD kategori |
| GET | `/api/produk` | Daftar produk; filter `?kategori=&jenis=&cari=` (tamu: hanya Aktif) |
| GET | `/api/produk/{id\|slug}` | Satu produk |
| POST/PUT/DELETE | `/api/produk[/{id}]` | (admin) CRUD produk |
| GET | `/api/promo` | Daftar promo (tamu: hanya yang berlaku) |
| GET | `/api/promo/cek?kode=` | (publik) cek satu kode promo |
| POST/PUT/DELETE | `/api/promo[/{id}]` | (admin) CRUD promo |
| POST | `/api/pesanan` | (publik) checkout — harga dihitung ulang di server |
| GET | `/api/pesanan[/{id}]` | (admin) daftar / detail pesanan |
| PUT | `/api/pesanan/{id}` | (admin) ubah status |
| DELETE | `/api/pesanan/{id}` | (admin) hapus |
| POST | `/api/pelanggan` | (publik) daftar akun pembeli |
| GET/PUT/DELETE | `/api/pelanggan[/{id}]` | (admin) kelola pelanggan |
| POST | `/api/creator` | (publik) pendaftaran creator |
| GET/PUT/DELETE | `/api/creator[/{id}]` | (admin) kelola creator |
| GET | `/api/ulasan/produk/{produkId}` | (publik) ulasan disetujui + rata-rata |
| GET | `/api/ulasan[/{id}]` | (admin) moderasi ulasan |
| POST | `/api/ulasan` | (publik) kirim ulasan (status: Menunggu) |
| PUT | `/api/ulasan/{id}` | (admin) setujui / sembunyikan |
| DELETE | `/api/ulasan/{id}` | (admin) hapus |
| GET/POST/DELETE | `/api/media[/{id}]` | (admin) kelola pustaka media (POST multipart `berkas`) |
| GET/DELETE | `/api/aktivitas` | (admin) lihat / kosongkan jejak aktivitas |

## Catatan keamanan

- Password disimpan memakai `password_hash()` (bcrypt) dan diverifikasi dengan
  `password_verify()` di server — tidak ada validasi kredensial di peramban.
- Seluruh query memakai prepared statement (PDO) — input tidak pernah
  disisipkan mentah ke SQL.
- Pada checkout, **server yang menghitung ulang** subtotal, biaya layanan
  (Rp1.000), potongan promo, dan total akhir dari harga produk di DB — harga
  dari klien tidak dipercaya.
- `config/config.php` dan `uploads/` diabaikan git (lihat `.gitignore` root).
  Salin `config/contoh.config.php` lalu isi kredensial lokal.
- Mode debug: set variabel lingkungan `GAMEKU_DEBUG=1` untuk menyertakan pesan
  exception di respons error (hanya untuk pengembangan).


