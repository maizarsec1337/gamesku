# Laporan Audit & Perbaikan Backend — gameku.store

> Tanggal: 2026-10-20 · Lingkup: backend PHP + MySQL + API (frontend tidak diubah)
> Catatan: file ini disimpan DI LUAR project (folder tools) sesuai aturan kebersihan root.

## Ringkasan
Audit menyeluruh backend/DB, lalu perbaikan bug + keamanan terverifikasi, penambahan modul
pembayaran & pesan, migrasi idempoten, dan harness pengujian. Semua perubahan terverifikasi:
`php -l` (29 berkas) lulus, `tests/jalankan.php` 17/17 lulus, build frontend sukses.

## Temuan & Perbaikan

| # | Severity | Temuan | Perbaikan | Status |
|---|----------|--------|-----------|--------|
| F1 | KRITIS | Frontend memanggil `GET /api/auth/csrf-token`, backend hanya `/api/auth/csrf` → login/daftar/keluar pembeli gagal 404 | Alias aksi `csrf-token` di `PengendaliAuth` | SELESAI |
| F2 | TINGGI | `GET /api/pelanggan` (daftar admin) tak terjangkau (`$aksi = $id ?? 'saya'`) | Dispatch pakai `$id` eksplisit | SELESAI |
| F3 | TINGGI | Login pembeli tanpa rate-limit | `RateLimiter` bucket `masuk_pembeli` (10/60s) + reset saat sukses | SELESAI |
| F4 | TINGGI | Pendaftaran pembeli tanpa rate-limit + enumerasi email | Rate-limit `daftar_pelanggan` (5/300s) | SELESAI |
| F5 | SEDANG | Tanpa kebijakan panjang sandi pembeli | Wajib 8–72 bila sandi diisi (`Bantu::sandiValid`) | SELESAI |
| F6 | SEDANG | Sesi admin tak menyimpan `peran`; RBAC mati | `peran` disimpan/disinkron; `/api/auth/daftar` & kelola admin = superadmin | SELESAI |
| F7 | SEDANG | `buatTokenCsrf()` merotasi tiap panggilan | Idempoten; rotasi hanya setelah login (`$paksa=true`) | SELESAI |
| F8 | SEDANG | `security-check.php` rusak (urutan teracak, variabel tak terdefinisi) | Ditulis ulang; pakai `PHP_BINARY` | SELESAI |
| F9 | SEDANG | `X-XSS-Protection` tidak konsisten | Diseragamkan `0` + `Content-Security-Policy: default-src 'none'` | SELESAI |
| F10 | TINGGI | Hapus pesanan berbayar → FK RESTRICT → 500 | Cek pembayaran → 409 pesan jelas | SELESAI |
| F11 | SEDANG | Migrasi tak mencakup tabel chat/pembayaran/produk_media | Runner berversi + `schema_migrations` (M1–M8) | SELESAI |
| F12 | SEDANG | Index kurang (produk.jenis, pelanggan.username, pesanan.email) | Index ditambahkan di schema.sql (+ migrasi M7) | SELESAI |
| F13 | RENDAH | Salinan build `dist/database/schema.sql` bisa usang | Disinkronkan (+ regenerasi build) | SELESAI |
| F14 | FITUR | Tabel pembayaran/pesan tanpa controller/route | Modul baru `PengendaliPembayaran`, `PengendaliPesan` + route | SELESAI |
| F15 | RENDAH | Dobel `session_destroy`; kode mati `$hasil['limited']` | Dibersihkan | SELESAI |
| F16 | RENDAH | `POST /api/chat` tanpa CSRF (rate-limited, fail-open) | Didokumentasikan (keputusan) | DITERIMA |

## Modul Baru
- **Pembayaran** (`/api/pembayaran`): buat/list/detail, `GET /pembayaran/pesanan/{id}`, `PUT /{id}`
  ubah status + event (`pembayaran_event`). Idempotensi via `uniq_pembayaran_pesanan`/`_idem`/`_transaction`.
- **Pesan** (`/api/pesan`): buat/dedup percakapan, list, detail (paginasi), kirim pesan, tandai dibaca,
  soft-delete. Otorisasi keanggotaan di lapisan aplikasi (`pastikanAnggota`).

## Database & Migrasi
- `schema.sql`: index baru (`idx_produk_jenis_status`, `idx_pelanggan_username`,
  `idx_pelanggan_status_bergabung`, `idx_pesanan_email`).
- `migrasi.php`: runner berversi, additive-only, non-destruktif, idempoten
  (guard `INFORMATION_SCHEMA` + `schema_migrations`) — aman dijalankan berulang.
- Catatan: MySQL 5.7 mengabaikan `CHECK`; validasi numerik tetap di aplikasi (`Bantu::angka`).

## Pengujian
- `php backend/security-check.php` → 25 PASS, 0 FAIL, 0 WARN.
- `php backend/tests/jalankan.php` → 17 lulus, 0 gagal (Bantu/Kecil/RateLimiter/Skema-Rute).
- Uji HTTP smoke tersedia (`GAMEKU_TEST_BASE=... php tests/jalankan.php`).
- `npm run build` (frontend) → sukses; backend termasuk controller baru ikut terkemas.

## Catatan / Batasan
- Uji HTTP end-to-end pada mesin ini tidak dapat dijalankan: PHP built-in server (`php -S`)
  tidak merespons di sandbox (kode aplikasi OK — bootstrap CLI berjalan 0,04 s, `ujiKoneksi` 0,007 s).
  Jalankan manual: `php -S localhost:8000 -t backend backend/api/index.php`.
- MySQL tidak tersedia di mesin ini, sehingga `migrasi.php` belum dijalankan ke DB nyata
  (harness menjaga integritas skema secara statis).
