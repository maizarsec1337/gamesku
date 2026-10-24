# Gameku.store — Rancangan Database Lengkap (TAHAP 3)

> Dokumen rancangan untuk review. **JANGAN dijalankan** ke database aktif.  
> Fokus: SQL, integritas, keamanan, migrasi bertahap.  
> Sedikitkan backend/frontend.

---

## 1. Ringkasan Arsitektur

### 1.1 Driver & Storage

- **MySQL 5.7+ / MariaDB 10.2+** — InnoDB, `utf8mb4_unicode_ci`
- `AUTO_INCREMENT` untuk kolom integer (admin, pesanan_item, aktivitas)
- `VARCHAR(40)` untuk ID semantik (prefix-time-rnd) dipakai di `instal.php` / `Bantu::idBaru()`
- Connector: PDO MySQL, `ATTR_EMULATE_PREPARES => false`
- `SET NAMES utf8mb4` / `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`

### 1.2 Prinsip Desain

- **Additive only** — setiap perubahan adalah `ADD COLUMN`, `ALTER`, `CREATE TABLE`, `CREATE INDEX`
- **Zero DROP TABLE / TRUNCATE / DELETE** dari data yang ada
- **Non-destructive FK** — gunakan `ON DELETE SET NULL`, `ON DELETE RESTRICT`, `ON DELETE CASCADE` sesuai logika bisnis
- **Snapshot vs live** — pembelian mendapat snapshot harga di `pesanan_item` (sudah ada), `pembayaran` konsisten, `audit_log` tetap
- **Ownership** — `owner_id` pada `media` dan chat untuk isolasi akses per pengguna
## 2. Tabel yang Ada

Ini adalah uji sisipan sederhana.
- **Idempotency** — migrasi divalidasi dengan pemeriksaan keberadaan tabel/kolom/index sebelum eksekusi
## 2. Tabel yang Ada (Tanpa Perubahan)
> Wajib dipertahankan.
| Kolom | Tipe | Batasan | Keterangan |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| pengguna | VARCHAR(60) | NOT NULL, UNIQUE | |
| sandi_hash | VARCHAR(255) | NOT NULL | password_hash()
| status | ENUM | NOT NULL, Default Aktif | Aktif/Nonaktif
| dibuat_pada | DATETIME | NOT NULL, Default CURRENT_TIMESTAMP |
| masuk_terakhir | DATETIME | NULL | Diupdate setiap login
### 2.2 kategori
| id | VARCHAR(40) | PK | |
| nama | VARCHAR(120) | NOT NULL | |
| slug | VARCHAR(140) | NOT NULL, UNIQUE | |
| deskripsi | TEXT | NULL | |
| ikon | VARCHAR(60) | NOT NULL, Default kategori | |
| gambar | VARCHAR(255) | NOT NULL, Default | |
| status | ENUM | NOT NULL, Default Aktif | |
| dibuat_pada | DATETIME | NOT NULL, Default CURRENT_TIMESTAMP |
| diperbaruni_pana | DATETIME | NULL |
| username | VARCHAR(60) | NOT NULL, Default | |
| produk | INT | NOT NULL, Default 0 | statistik |
| penjualan | INT | NOT NULL, Default 0 | statistik |
| pendapatan | BIGINT | NOT NULL, Default 0 | statistik |
| bergabung | DATETIME | NOT NULL, Default CURRENT_TIMESTAMP | |
| status | ENUM | NOT NULL, Default Review | Aktif/Review/Ditangguhkan |
| jenis | VARCHAR(30) | NOT NULL, Default Skin | |
| deskripsi_singkat | VARCHAR(300) | NOT NULL, Default | |
| deskripsi_lengkap | TEXT | NULL | |
| harga | BIGINT | NOT NULL, Default 0, CHECK >= 0 | |
| harga_diskon | BIGINT | NOT NULL, Default 0, CHECK >= 0 | |
| thumbnail | VARCHAR(255) | NOT NULL, Default | |
| preview | JSON | NULL | |
| file_produk | VARCHAR(255) | NOT NULL, Default | |
| versi_minecraft | VARCHAR(60) | NOT NULL, Default | |
| creator | VARCHAR(120) | NOT NULL, Default | string - will replace with FK |
| status | ENUM | NOT NULL, Default Draft | Draft/Aktif/Nonaktif |
| kode | VARCHAR(40) | NOT NULL, UNIQUE | |
| diskon | TINYINT UNSIGNED | NOT NULL, Default 0 | 0-100 |
| mulai | DATE | NULL | |
| berakhir | DATE | NULL | |
| batas | INT | NOT NULL, Default 100 | maksimum penggunaan |
| terpakai | INT | NOT NULL, Default 0 | |
| kategori | VARCHAR(120) | NOT NULL, Default | display |
| metode | VARCHAR(60) | NOT NULL, Default | |
| subtotal | BIGINT | NOT NULL, Default 0 | |
| biaya_layanan | BIGINT | NOT NULL, Default 0 | |
| potongan | BIGINT | NOT NULL, Default 0 | |
| total | BIGINT | NOT NULL, Default 0 | snapshot |
| kode_promo | VARCHAR(40) | NOT NULL, Default | |
| catatan | VARCHAR(255) | NOT NULL, Default | |
| produk_id | VARCHAR(40) | FK -> produk.id, ON DELETE CASCADE | |
| produk_nama | VARCHAR(160) | NOT NULL, Default | snapshot |
| pelanggan_id | VARCHAR(40) | NULL | |
| pelanggan_nama | VARCHAR(120) | NOT NULL, Default | snapshot |
| rating | TINYINT UNSIGNED | NOT NULL, Default 5 | 1-5 |
| komentar | TEXT | NULL | |
| tanggal | DATETIME | NOT NULL | |
| status | ENUM | NOT NULL, Default Menunggu | Menunggu/Disetujui/Disembunyikan |
| nama | VARCHAR(200) | NOT NULL | |
| mime | VARCHAR(80) | NOT NULL, Default | |
| ukuran | BIGINT | NOT NULL, Default 0 | |
| berkas | VARCHAR(255) | NOT NULL, Default | |
| url | VARCHAR(255) | NOT NULL, Default | /uploads/* |
| tanggal | DATETIME | NOT NULL | will split |
| pelanggan_id | VARCHAR(40) | FK -> pelanggan.id, CASCADE | |
| video_id | VARCHAR(120) | eksternal (bukan DB lokal) | |
| mulai_menonton | DATETIME | | |
| posisi_detik | INT UNSIGNED | 0-86400 | |
| durasi_detik | INT UNSIGNED | nullable | |
| progres_persen | DECIMAL(5,2) | generated | |
| selesai | TINYINT(1) | generated | |
| terakhir_ditonton | DATETIME | | |
| dibuat_pada | DATETIME | | |
| diperbaruni_pana | DATETIME | | |
| teks | VARCHAR(255) | NOT NULL | |
| ikon | VARCHAR(40) | NOT NULL, Default centangLingkaran | |
| warna | VARCHAR(20) | NOT NULL, Default hijau | |
| admin_pengguna | VARCHAR(60) | NULL | string - will replace with FK |
| dibuat_pada | DATETIME | NOT NULL | |
## 3. Tabel yang Perlu Ditambahkan
### 3.1 media (perbaikan)
| id | VARCHAR(40) | PK | |
| owner_id | VARCHAR(40) | FK -> pelanggan.id, SET NULL | pemilik upload |
| nama | VARCHAR(200) | NOT NULL | |
| jenis | VARCHAR(30) | NOT NULL, Default Thumbnail | |
| mime | VARCHAR(80) | NOT NULL, Default | |
| ukuran | BIGINT | NOT NULL, Default 0, CHECK >= 0 | |
| berkas | VARCHAR(255) | NOT NULL, Default | |
| url | VARCHAR(255) | NOT NULL, Default | /uploads/* |
| checksum | VARCHAR(64) | NULL | SHA-256 hex (tidak menyimpan data) |
| dibuat_pana | DATETIME | NOT NULL, Default CURRENT_TIMESTAMP | |
| diperbaruni_pana | DATETIME | NULL | |
| kategori_id | VARCHAR(40) | FK -> kategori.id, SET NULL | (opsional) |
| judul | VARCHAR(200) | NOT NULL, Default | |
| status | ENUM(Aktif,Tutup) | NOT NULL, Default Aktif | |
| id | VARCHAR(40) | PK | |
| percakunan_id | VARCHAR(40) | NOT NULL |
| user_id | VARCHAR(40) | NOT NULL |
| peran | ENUM(Pembicara,Moderator,Pengelola) | NOT NULL, Default Pembicara |
| id | VARCHAR(40) | PK | |
| percakunan_id | VARCHAR(40) | NOT NULL |
| pengirim_id | VARCHAR(40) | NOT NULL |
| lampiran_id | VARCHAR(40) | NULL | FK ke media.id |
| teks | TEXT | NULL | |
| tipe | VARCHAR(30) | NOT NULL, Default text | text, image, file |
| dikirim_pada | DATETIME | NOT NULL | |
| dibaca_pada | DATETIME | NULL | |
| id | VARCHAR(40) | PK | |
| pesanan_id | VARCHAR(40) | NOT NULL |
| nominal | BIGINT | NOT NULL, Default 0, CHECK >= 0 | |
| metode | VARCHAR(60) | NOT NULL, Default | |
| akun_pembayaran | VARCHAR(255) | NOT NULL, Default | rekening/identitas tanpa PIN/CVV |
| referensi | VARCHAR(255) | NULL | label transaksi |
| status | ENUM | NOT NULL, Default Menunggu konfirmasi | |
| kode_idempotensi | VARCHAR(64) | NULL | idempotency key |
| transaction_id | VARCHAR(120) | NULL | reference gateway |
| konfirmasi_admin | VARCHAR(60) | NULL | |
| catatan | VARCHAR(255) | NOT NULL, Default | |
| refund_at | DATETIME | NULL | |
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| user_id | VARCHAR(40) | FK -> admin.id, SET NULL | |
| jenis_aktivitas | VARCHAR(60) | NOT NULL | |
| target_table | VARCHAR(60) | NULL | |
| target_id | VARCHAR(40) | NULL | |
| detail_json | JSON | NULL | |
| teks | VARCHAR(255) | NOT NULL | |
| ikon | VARCHAR(40) | NOT NULL, Default centangLingkaran | |
| warna | VARCHAR(20) | NOT NULL, Default hijau | |
| admin_pengguna | VARCHAR(60) | NULL | |
| dibuat_pada | DATETIME | NOT NULL | |
| id | VARCHAR(40) | PK | |
| pesanan_id | VARCHAR(40) | NOT NULL |
| produk_id | VARCHAR(40) | NULL |
| harga_satuan | BIGINT | NOT NULL, Default 0 |
| jumlah | INT | NOT NULL, Default 1 |
| total_snapshot | BIGINT | NOT NULL, Default 0 |
| catatan | VARCHAR(255) | NULL |
| dibuat_pada | DATETIME | NOT NULL | |
## 4. Rancangan Migrasi (Draft SQL)
> Lokasi: backend/database/migrations/.
> JANGAN dijalankan sampai disetujui.
> Prinsip: additive only, non-destructive, idempotent, rollback-safe.

### 4.1 V1__media_owner_and_timestamp.sql
- Target: backend/database/skema.sql
- Tambah kolom: owner_id, checksum, dibuat_pana, diperbaruni_pana
- Update: dibuat_pana = tanggal
- Buat index: idx_media_owner_jenis
- Risiko: zero data loss (ADD COLUMN non-destructive)
- Validasi: SHOW CREATE TABLE media

### 4.2 V2__creator_fk_to_produk.sql
- Target: backend/database/skema.sql
- Tambah creator_id FK ke produk; backfill dari string creator
- Opsional: drop old creator string column
- Risiko: backfill gagal jika data creator tidak cocok
- Validasi: SELECT COUNT(*) FROM produk WHERE creator_id NOT IN (SELECT id FROM creator)

### 4.3 V3__chat_tables.sql
- Target: backend/database/skema.sql
- Buat percakunan, anggota_peserta, pesan
- Relasi: percakunan_id -> pesan; lampiran_id -> media; user_id -> pelanggan
- Risiko: ON DELETE CASCADE untuk anggota_peserta
- Validasi: SHOW TABLES LIKE ...

### 4.4 V4__pembayaran_and_audit_log.sql
- Target: backend/database/skema.sql
- Buat pembayaran (idempotency, transaction_id, status, refund_at)
- Buat audit_log (user_id FK ke admin)
- Risiko: pembayaran ON DELETE CASCADE dari pesanan
- Validasi: SHOW TABLES LIKE ...

### 4.5 V5__indexes_and_checks.sql
- Tambah index: audit_log, media, pesanan, produk
- Tambah CHECK constraint untuk ukuran, harga, nominal
- Risiko: tambahan index meningkatkan biaya tulis
- Validasi: SHOW INDEX FROM ...

### 4.6 V6__pesanan_item_add_timestamps.sql
- Target: backend/database/skema.sql
- Tambah dibuat_pana, diperbaruni_pana ke pesanan_item
- Risiko: zero data loss (ADD COLUMN non-destructive)
- Validasi: SELECT COUNT(*) FROM pesanan_item

---
*Dokumen ini adalah draft. JANGAN dijalankan sebelum persetujuan.*
## 5. Analisis Kompatibilitas
- Tabel admin: TIDAK diubah. Data dan struktur dipertahankan.
- Creator: Kolom creator di produk adalah STRING. Migrasi V2 menggunakan creator_id FK; backfill memetakan data yang cocok.
- Pesanan / pesanan_item: Sudah memiliki snapshot (harga, subtotal, nama).
- Relasi pengguna: Berdasarkan tabel akun yang ada (pelanggan, admin), bukan users atau auth hallucinatif.
- Hindari duplikasi: aktivitas legacy ditinggalkan (opsional); audit_log adalah peningkatan.

## 6. Keamanan & Ketalusan
- TIDAK pernah menyimpan PIN, CVV, password, token, kredensial dalam pembayaran, media, atau audit_log.
- akun_pembayaran hanya metadata, tanpa informasi sensitif.
- audit_log.detail_json berisi teks yang aman (tidak sensitive).
- Ownership: media.owner_id untuk isolasi akses; pesan filterable melalui anggota_peserta.
- Authorization: pesanan filterable melalui pelanggan_id; audit_log filterable melalui user_id.
- Constraints: CHECK untuk ukuran >= 0, harga >= 0, nominal >= 0 (MySQL 5.7 may ignore CHECK).

## 7. Checklist Pra-Migrasi & Skenario Pengujian

### 7.1 Checklist
- [ ] Backup seluruh database (mysqldump)
- [ ] Pastikan skema.sql asli tidak berubah
- [ ] Salin skema.sql ke .bak bila diperlukan
- [ ] Tunjukkan migrasi ke pengguna untuk persetujuan
- [ ] Verifikasi MySQL/MariaDB version (5.7 vs 8.0)
- [ ] Validasi utf8mb4 dan InnoDB support
- [ ] Pastikan frontend tidak mengakses kolom baru sebelum siap
- [ ] Uji rollback: restore backup
- [ ] Verifikasi ketersediaan CREATE TABLE IF NOT EXISTS dan ALTER TABLE ADD COLUMN

### 7.2 Skenario Pengujian
- [ ] Dry run: jalankan mysql < migration.sql terhadap copy dari production
- [ ] Idempotency: jalankan dua kali; kedua run adalah no-op
- [ ] FK integrity: SELECT COUNT(*) FROM pesanan_item WHERE pesanan_id NOT IN (SELECT id FROM pesanan) = 0
- [ ] Creator mapping: SELECT COUNT(*) FROM produk WHERE creator_id NOT IN (SELECT id FROM creator) = 0
- [ ] Unique constraint: SELECT COUNT(*) FROM pembayaran GROUP BY transaction_id HAVING COUNT(*) > 1 = 0
- [ ] CHECK constraint: SELECT COUNT(*) FROM media WHERE ukuran < 0 = 0
- [ ] Index: EXPLAIN query audit report, search, user list
- [ ] Rollback: restore database, verify original schema

## 8. Kesimpulan

Rancangan lengkap mencakup 7 tabel baru / 1 tabel diubah (media):
1. media (perbaikan) 2. percakunan 3. anggota_peserta 4. pesan 5. pembayaran 6. audit_log 7. pembelian_snapshot (opsional)

Semua perubahan bersifat non-destructive, idempotent, dan rollback-safe.

---
*File ini adalah dokumen untuk review. JANGAN dijalankan ke database aktif.*
