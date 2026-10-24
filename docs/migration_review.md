# REVIEW TEKNIS READ-ONLY — Draft Migrasi SQL Gameku.store (V1–V6)

> Sifat: READ-ONLY. Tidak mengedit migrasi, skema, backend, atau database. Tidak menjalankan SQL.
> Tidak menampilkan kredensial konfigurasi.
> Sumber yang dibandingkan (read-only):
> - `backend/database/migrations/V1__media_owner_and_timestamp.sql` s/d `V6__pesanan_item_add_timestamps.sql`
> - `backend/database/skema.sql` (sumber; `dist/database/skema.sql` adalah salinan build)
> - `docs/audit_report.md`, `docs/database_design.md`
> - `backend/config/contoh.config.php` (hanya struktur kunci, tanpa rahasia), `backend/database/instal.php` (mekanisme eksekusi)

## 0. Ringkasan keputusan

| Migrasi | Keputusan | Alasan satu baris |
|---|---|---|
| V1 media owner+timestamp | PERLU REVISI | Bug UPDATE kolom tidak ada + ejaan timestamp menyimpang + tidak idempoten |
| V2 creator_fk_to_produk | PERLU REVISI | ADD COLUMN/FK tidak idempoten + backfill username nondeterministik; tingkat kecocokan data BELUM DAPAT DIVERIFIKASI tanpa salinan data |
| V3 chat_tables | PERLU REVISI | Ejaan timestamp + FK hanya ke pelanggan + isolasi hanya di aplikasi + index kurang |
| V4 pembayaran_and_audit_log | PERLU REVISI | Kontradiksi UNIQUE(pesanan_id) vs idempotency per-attempt + kode_idempotensi tanpa UNIQUE + FK audit_log salah tipe + CASCADE menghapus bukti |
| V5 indexes_and_checks | PERLU REVISI | Sintaks CREATE INDEX IF NOT EXISTS tidak valid + kolom penjual_id tidak ada + duplikat index V4/skema |
| V6 pesanan_item_add_timestamps | PERLU REVISI | UPDATE merujuk kolom tidak ada + ejaan timestamp + tidak ada sumber backfill |

Tidak ada migrasi yang LULUS untuk dijalankan apa adanya.

## 1. Metode verifikasi

- Membaca seluruh file migrasi baris-per-baris dan mencocokkan nama tabel/kolom/tipe dengan `skema.sql` aktual.
- Fakta skema aktual yang dipakai sebagai acuan:
  - `admin.id` = INT UNSIGNED AUTO_INCREMENT (bukan VARCHAR).
  - `kategori.id`, `creator.id`, `produk.id`, `pelanggan.id`, `pesanan.id`, `media.id` = VARCHAR(40).
  - `pesanan_item.id` = BIGINT UNSIGNED AUTO_INCREMENT; `aktivitas.id` = BIGINT UNSIGNED AUTO_INCREMENT.
  - Ejaan baku di skema: `diperbarui_pada` (kategori, produk, pesanan, riwayat_tontonan). Bukan `diperbaruni_pana`.
  - `media` aktual: id, nama, jenis, mime, ukuran BIGINT DEFAULT 0, berkas, url, tanggal DATETIME DEFAULT CURRENT_TIMESTAMP, KEY idx_media_jenis(jenis).
  - `produk.creator` aktual: VARCHAR(120) NOT NULL DEFAULT ''. `pesanan` aktual: tanpa `penjual_id`; status ENUM Menunggu/Diproses/Berhasil/Gagal.
  - `pesanan_item` aktual: tanpa kolom timestamp.
  - Target engine: MySQL 5.7+/MariaDB 10.2+, InnoDB, utf8mb4_unicode_ci (lihat skema + instal.php).
- `instal.php` mengeksekusi skema dengan split `;` akhir baris via PDO dan hanya mengabaikan galat berpesan `already exists`. Itu tidak mencakup galat Duplicate column/key/constraint/FK/Unknown column/syntax.
## 2. V1__media_owner_and_timestamp.sql — PERLU REVISI

Keputusan: PERLU REVISI. Jangan dijalankan apa adanya.

### 2.1 F-V1-01 [KRITIS] UPDATE merujuk kolom yang tidak ada (baris 27)
- Baris 20 membuat `diperbaruni_pana`, baris 19 membuat `dibuat_pada`, tetapi baris 27 mengeksekusi `UPDATE media SET dibuat_pana = tanggal`.
- `dibuat_pana` tidak pernah dibuat. Hasil di MySQL/MariaDB: ERROR 1054 Unknown column 'dibuat_pana'.
- Dampak: migrasi berhenti di tengah setelah ALTER berhasil (DDL implicit commit, lihat bagian 8), menyisakan skema parsial.
- Koreksi: ganti menjadi `UPDATE media SET dibuat_pada = tanggal WHERE tanggal IS NOT NULL;` dan verifikasi nama kolom hasil ALTER terlebih dahulu. Hapus baris ini bila kolom `tanggal` ternyata NULL semua.

### 2.2 F-V1-02 [TINGGI] Ejaan timestamp menyimpang dari skema (baris 19-20,24,27)
- Skema baku memakai `diperbarui_pada` (kategori:33, produk:70, pesanan:131, riwayat_tontonan:214). Draf memakai `dibuat_pana`/`diperbaruni_pana`.
- Dampak: konvensi ganda permanen, ORM/query harus mengingat dua ejaan, risiko bug baca-tulis.
- Koreksi: gunakan `dibuat_pada` dan `diperbarui_pada` di semua migrasi baru. Jangan membuat `diperbaruni_pana`.

### 2.3 F-V1-03 [TINGGI] Tidak idempoten: ADD COLUMN dan CREATE INDEX tanpa guard (baris 16-20,32)
- `ALTER TABLE ADD COLUMN` kedua kali gagal Duplicate column; `CREATE INDEX idx_media_owner_jenis` kedua kali gagal Duplicate key name.
- `CREATE TABLE IF NOT EXISTS` tidak berlaku di sini. Klaim idempoten pada dokumen desain tidak terbukti untuk V1.
- Koreksi: bungkus tiap ADD dengan pemeriksaan INFORMATION_SCHEMA, contoh pola MySQL 5.7+ (prosedur atau skrip runner), atau catat eksplisit bahwa file hanya boleh jalan sekali dan runner harus mencatat versi. Paling aman: buat tabel `schema_migrations(version PRIMARY KEY)` dan cek sebelum jalan.

### 2.4 F-V1-04 [SEDANG] Kolom NOT NULL baru pada tabel berisi data (baris 19)
- `dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` pada tabel `media` yang sudah ada akan mengisi baris lama dengan waktu migrasi, bukan waktu asli, sebelum UPDATE backfill berjalan.
- Jika UPDATE gagal (lihat F-V1-01), data timestamp lama tertutup waktu migrasi.
- Koreksi: buat sebagai NULL dulu, backfill dari `tanggal`, lalu ALTER menjadi NOT NULL bila perlu. Atau biarkan NULL + DEFAULT.

### 2.5 F-V1-05 [SEDANG] owner_id polimorfik tanpa FK (baris 17)
- Komentar menyebut pemilik bisa pelanggan/creator/admin, tetapi ketiga tabel punya PK berbeda: pelanggan VARCHAR(40), creator VARCHAR(40), admin INT UNSIGNED.
- Satu kolom VARCHAR(40) tidak bisa di-FK-kan ke ketiganya sekaligus; tanpa FK maka integritas hanya di aplikasi.
- Ini bukan bug eksekusi, tetapi harus didokumentasikan: FK saja tidak cukup; butuh cek aplikasi + index. Jangan tambahkan FK owner_id ke satu tabel saja karena akan menolak dua jenis pemilik lain.
- Koreksi: tetapkan desain eksplisit — opsi A: owner_id tanpa FK + owner_tipe ENUM + index; opsi B: tiga kolom nullable terpisah. Jangan biarkan ambigu.

## 3. V2__creator_fk_to_produk.sql — PERLU REVISI

Keputusan: PERLU REVISI. Tingkat kecocokan data lama BELUM DAPAT DIVERIFIKASI tanpa salinan data.

### 3.1 F-V2-01 [TINGGI] ADD COLUMN dan ADD CONSTRAINT tidak idempoten (baris 17-18,41-43)
- Eksekusi kedua gagal: Duplicate column 'creator_id' dan Duplicate FK/constraint 'fk_produk_creator' (pesan bukan 'already exists', jadi tidak diabaikan instal.php).
- Koreksi: guard INFORMATION_SCHEMA.COLUMNS dan INFORMATION_SCHEMA.TABLE_CONSTRAINTS, atau runner versi bermigrasi.

### 3.2 F-V2-02 [TINGGI] Backfill username nondeterministik (baris 25-38)
- Skema creator: UNIQUE hanya pada `nama` (skema.sql:49). `username` tidak unique, boleh '' default (skema.sql:42).
- Klausa `OR c.username = p.creator` dapat cocok ke banyak baris; `LIMIT 1` memilih sembarang baris. Jika dua creator memakai username sama/kosong, pemetaan salah dan tidak terdeteksi.
- Tambahan: `WHERE p.creator != ''` memakai perbandingan case/collation-sensitive; di utf8mb4_unicode_ci, 'Budi' = 'budi'. Cocok sebagian karena collation, bukan equality eksak.
- Koreksi: (1) backfill hanya via id eksak + nama (yang UNIQUE), (2) laporkan baris tak-cocok ke tabel laporan, jangan tebak via username, (3) buat creator_id NULL-able dan biarkan NULL bila ambigu, (4) verifikasi manual sebelum ADD FK.

### 3.3 F-V2-03 [SEDANG] ADD FK dapat gagal karena data lama (baris 41-43)
- Jika ada creator_id menunjuk id creator yang tidak ada (misal creator dihapus tanpa FK sebelumnya), ADD CONSTRAINT gagal ERROR 1452.
- Koreksi: sebelum ADD FK jalankan query validasi `SELECT COUNT(*) FROM produk WHERE creator_id IS NOT NULL AND creator_id NOT IN (SELECT id FROM creator)` harus 0 pada salinan DB. Sertakan di checklist.

### 3.4 F-V2-04 [SEDANG] Kompatibilitas aplikasi ganda
- Audit menyebut PengendaliProduk masih membaca kolom string `creator`. Draf mempertahankan kolom lama (benar), tetapi dokumen desain juga menyebut 'drop creator string column' sebagai rencana. Itu kontradiktif.
- Koreksi: tegaskan kolom `creator` TIDAK di-drop pada tahap ini. Tulis strategi dual-write: tulis creator string + creator_id bersamaan di backend nanti; baca fallback creator_id -> creator.

## 4. V3__chat_tables.sql — PERLU REVISI

Keputusan: PERLU REVISI.

### 4.1 F-V3-01 [SEDANG] Ejaan timestamp menyimpang (baris 19)
- `diperbaruni_pana` vs baku `diperbarui_pada`. Sama seperti V1. Koreksi ejaan sebelum disetujui agar konsisten lintas tabel.

### 4.2 F-V3-02 [TINGGI] FK user hanya ke pelanggan; admin/creator tidak bisa chat (baris 39-41,58-60)
- `anggota_peserta.user_id -> pelanggan(id)` dan `pesan.pengirim_id -> pelanggan(id)`. Admin (INT) dan creator (VARCHAR tapi tabel berbeda) tidak dapat menjadi anggota/pengirim tanpa melanggar FK.
- Jika kebutuhan nyata mencakup CS admin atau chat penjual (creator), desain ini memblokirnya.
- Koreksi: putuskan model identitas: opsi A polimorfik (user_tipe + user_id tanpa FK + validasi aplikasi), opsi B tabel pengguna terpadu, opsi C FK terpisah per peran. Jangan klaim 'chat per pengguna' bila hanya pelanggan.

### 4.3 F-V3-03 [TINGGI] Isolasi chat hanya mengandalkan FK; tanpa enforcement keanggotaan pengirim (baris 44-64)
- FK memastikan pengirim adalah pelanggan valid, tetapi TIDAK memastikan pengirim adalah anggota percakunan tersebut. User A yang bukan anggota tetap bisa INSERT pesan ke percakunan milik orang lain bila aplikasi lupa cek.
- Benar bahwa FK saja tidak cukup; draf belum menambahkan mekanisme DB untuk ini (dan memang sulit murni di DB).
- Koreksi: dokumentasikan bahwa otorisasi wajib di lapisan aplikasi (cek uniq_anggota sebelum INSERT/SELECT pesan), tambahkan index untuk cek cepat (lihat F-V3-04), dan uji penetrasi logika di salinan DB.

### 4.4 F-V3-04 [SEDANG] Index kurang untuk query chat (baris 44-64)
- Query umum 'daftar pesan per percakunan terurut waktu' butuh KEY(percakunan_id, dikirim_pada/id). Hanya ada FK index implisit percakunan_id. Query 'pesan belum dibaca per user' butuh filter anggota+percakunan.
- Koreksi: tambah `KEY idx_pesan_percakunan_kirim (percakunan_id, dikirim_pada, id)` dan `KEY idx_pesan_pengirim (pengirim_id)`. Ukur dengan EXPLAIN pada salinan data.

### 4.5 F-V3-05 [RENDAH] CREATE TABLE IF NOT EXISTS bukan idempotensi penuh
- Jika tabel ada tetapi definisi lama berbeda (misal kolom kurang), IF NOT EXISTS diam-diam no-op dan skema tetap usang. Runner mengira sukses.
- Koreksi: verifikasi pasca-migrasi via INFORMATION_SCHEMA (kolom, FK, index) bukan hanya 'tanpa galat'.

## 5. V4__pembayaran_and_audit_log.sql — PERLU REVISI

Keputusan: PERLU REVISI.

### 5.1 F-V4-01 [KRITIS] UNIQUE(pesanan_id) bertentangan dengan idempotency per-attempt (baris 33 vs baris 25)
- Komentar menyebut kode_idempotensi sebagai 'idempotency key per attempt', artinya satu pesanan dapat memiliki banyak baris percobaan bayar. Namun baris 33 memaksa satu baris per pesanan.
- Dampak: retry dengan idempotency key baru gagal Duplicate entry; atau jika retry menimpa baris, riwayat attempt hilang. Desain tidak konsisten.
- Koreksi: pilih satu model dan tulis eksplisit — Model A satu pembayaran per pesanan: UNIQUE(pesanan_id) + kode_idempotensi UNIQUE sebagai kunci retry; retry memakai key sama (UPSERT), bukan baris baru. Model B banyak attempt per pesanan: hapus UNIQUE(pesanan_id), tambah UNIQUE(kode_idempotensi), tambah kolom attempt_no/status_attempt. Jangan campur keduanya.

### 5.2 F-V4-02 [TINGGI] kode_idempotensi tanpa UNIQUE sehingga tidak mencegah ganda (baris 25)
- Tanpa UNIQUE, dua INSERT dengan key sama sama-sama lolos; idempotensi hanya klaim komentar.
- Koreksi: `UNIQUE KEY uniq_pembayaran_idem (kode_idempotensi)` bila memakai Model A/B. Perhatikan NULL dapat duplikat di MySQL (banyak NULL diizinkan di UNIQUE), jadi kolom harus NOT NULL dengan default key yang di-generate aplikasi, atau gunakan UNIQUE hanya bila NOT NULL.

### 5.3 F-V4-03 [TINGGI] UNIQUE(transaction_id) nullable memblokir banyak NULL? Tidak, tetapi berisiko (baris 34)
- Di MySQL/InnoDB, UNIQUE mengizinkan banyak NULL, jadi baris manual-transfer (transaction_id NULL) tidak saling blokir. Itu benar secara teknis.
- Namun bila gateway mengirim string kosong '' bukan NULL, semua '' dianggap sama dan INSERT kedua gagal Duplicate. Aplikasi harus menormalkan '' menjadi NULL.
- Koreksi: dokumentasikan normalisasi '' -> NULL di backend nanti; atau buat kolom NULL tanpa default ''.

### 5.4 F-V4-04 [KRITIS] FK audit_log.user_id salah tipe dan salah target (baris 61-63)
- `audit_log.user_id` VARCHAR(40) di-FK-kan ke `admin(id)` yang INT UNSIGNED. MySQL ERROR 150: tipe FK harus sama (INT vs VARCHAR tidak kompatibel).
- Komentar mengklaim user bisa pelanggan/creator/admin, tetapi FK hanya ke admin. Pelanggan/creator valid akan ditolak ERROR 1452.
- Koreksi: hapus FK tersebut. Ganti dengan user_tipe + user_id tanpa FK + index, atau dua kolom terpisah. Jangan biarkan migrasi gagal saat tabel dibuat.

### 5.5 F-V4-05 [TINGGI] ON DELETE CASCADE pembayaran menghapus bukti bayar (baris 36-38)
- Jika pesanan dihapus, seluruh riwayat pembayaran ikut hilang. Untuk ledger 5 tahun (klaim audit_report bagian 6), ini melanggar retensi.
- Koreksi: gunakan ON DELETE RESTRICT (tolak hapus pesanan berbayar) atau SET NULL dengan pesanan_id NULL-able + snapshot pesanan. Putuskan kebijakan retensi sebelum migrasi.

### 5.6 F-V4-06 [SEDANG] Ejaan timestamp + JSON version (baris 31,50)
- `diperbaruni_pana` menyimpang (lihat V1). Kolom JSON butuh MySQL 5.7+/MariaDB 10.2.7+; di MariaDB lama JSON adalah alias LONGTEXT tanpa validasi. Catat versi minimum di header migrasi.

## 6. V5__indexes_and_checks.sql — PERLU REVISI

Keputusan: PERLU REVISI. File ini tidak dapat dijalankan apa adanya.

### 6.1 F-V5-01 [KRITIS] Sintaks tidak valid: CREATE INDEX IF NOT EXISTS (baris 18,21,24,27,31,34,38,42)
- MySQL dan MariaDB TIDAK mendukung IF NOT EXISTS pada CREATE INDEX. Hasil: ERROR 1064 syntax error pada statement pertama.
- Koreksi: gunakan ALTER TABLE ADD INDEX dengan guard INFORMATION_SCHEMA.STATISTICS, atau dokumentasikan bahwa V5 hanya untuk DB kosong. Jangan klaim idempoten.

### 6.2 F-V5-02 [KRITIS] Kolom tidak ada: pesanan.penjual_id (baris 38-39)
- Skema pesanan (baris 114-138) tidak memiliki `penjual_id`. CREATE INDEX atas kolom tidak ada gagal ERROR 1072.
- Audit menyebut penjual_id sebagai kebutuhan, tetapi tidak ada migrasi yang membuatnya. V5 mengasumsikan kolom yang belum ada.
- Koreksi: buat migrasi terpisah ADD penjual_id (NULL-able, FK diputuskan) sebelum index, atau hapus blok 5.3 dari V5.

### 6.3 F-V5-03 [SEDANG] Index duplikat dengan V4 dan skema (baris 18-35)
- idx_audit_* sudah dibuat di V4; idx_media_jenis sudah ada di skema (KEY idx_media_jenis). Eksekusi ulang gagal Duplicate key name.
- idx_media_tanggal merujuk `media.dibuat_pada` yang baru ada setelah V1; urutan V1<V5 wajib. Jika V5 jalan sebelum V1, gagal Unknown column.
- Koreksi: hapus duplikat atau beri guard; nyatakan dependensi V5 SETELAH V1 dan V4.

### 6.4 F-V5-04 [SEDANG] ADD CONSTRAINT CHECK tanpa nama guard (baris 48)
- Eksekusi kedua gagal Duplicate constraint 'chk_media_ukuran'. MySQL 5.7 mengabaikan CHECK (hanya warning/parse), MariaDB 10.2+ menegakkan. Perilaku berbeda antar versi harus dicatat.
- Koreksi: guard INFORMATION_SCHEMA.TABLE_CONSTRAINTS; catat bahwa di 5.7 validasi tetap di aplikasi.

## 7. V6__pesanan_item_add_timestamps.sql — PERLU REVISI

Keputusan: PERLU REVISI.

### 7.1 F-V6-01 [KRITIS] UPDATE merujuk kolom tidak ada (baris 19)
- Baris 15-16 membuat `dibuat_pada` dan `diperbaruni_pana`, tetapi baris 19 mengeksekusi `UPDATE pesanan_item SET dibuat_pana = dibuat_pada`.
- `dibuat_pana` tidak ada. Hasil: ERROR 1054. Sama polanya dengan V1; kemungkinan copy-paste.
- Koreksi: tidak ada sumber waktu historis di pesanan_item (tidak ada kolom tanggal lama), jadi HAPUS baris UPDATE. Biarkan DEFAULT CURRENT_TIMESTAMP mengisi baris lama dengan waktu migrasi dan dokumentasikan itu sebagai keterbatasan.

### 7.2 F-V6-02 [SEDANG] Ejaan + ADD COLUMN tidak idempoten (baris 14-16)
- `diperbaruni_pana` menyimpang dari baku. ADD COLUMN ganda gagal Duplicate column.
- Koreksi: ejaan baku + guard INFORMATION_SCHEMA.

## 8. Risiko migrasi parsial (implicit commit) — berlaku semua file

- Fakta: di MySQL/MariaDB, statement DDL (ALTER TABLE, CREATE TABLE, CREATE INDEX) menyebabkan implicit commit. Tidak dapat dibungkus dalam satu transaksi atomik lintas DDL+DML.
- Dampak nyata di draf ini: V1 (ALTER sukses lalu UPDATE gagal F-V1-01), V6 (ADD sukses lalu UPDATE gagal F-V6-01), V5 (statement 1 syntax error, statement lain belum jalan) semuanya menyisakan skema parsial bila dijalankan via mysql client atau instal.php yang melanjutkan per-statement.
- Rekomendasi: (1) perbaiki semua bug UPDATE/sintaks dulu, (2) jalankan hanya di salinan DB, (3) snapshot/backup sebelum tiap file, (4) verifikasi INFORMATION_SCHEMA setelah tiap file, (5) gunakan runner bermigrasi-versi (tabel schema_migrations) agar file gagal tidak ditandai sukses.

## 9. Kompatibilitas aplikasi (struktur lama masih dipakai)

- `produk.creator` string dipertahankan (V2 tidak men-drop; komentar DROP hanya opsional). Aplikasi lama tetap jalan. Setelah revisi, tetapkan dual-write backend: tulis kedua kolom; baca creator_id dulu, fallback creator.
- `media.tanggal` dipertahankan (DROP hanya komentar di V1:35). Aplikasi pembaca `tanggal` tetap jalan. Setelah backfill terverifikasi, putuskan satu sumber kebenaran.
- `pesanan` tanpa penjual_id: aplikasi tidak boleh query penjual_id sebelum migrasi pembuat kolom disetujui.
- `aktivitas` legacy dipertahankan; `audit_log` adalah tambahan, bukan pengganti, hingga backend dual-write siap.

## 10. Urutan migrasi yang disarankan (setelah revisi disetujui)

1. V1-revisi (media owner+timestamp baku) — prasyarat V5 media index.
2. V2-revisi (creator_id + backfill id/nama saja + validasi orfan) — ADD FK terakhir setelah laporan kecocokan ditinjau.
3. V3-revisi (chat; ejaan baku + model identitas diputuskan + index pesan) — setelah V1 (FK lampiran ke media tetap valid).
4. V4-revisi (pembayaran model A/B diputuskan + audit_log tanpa FK salah tipe) — butuh pesanan sudah ada (ya).
5. V6-revisi (pesanan_item timestamp; tanpa UPDATE) — independen, bisa kapan saja setelah backup.
6. V5-revisi (index+check dengan guard; setelah kolom target ada) — terakhir.
- Jangan menjalankan V5 sebelum V1/V4. Jangan ADD FK sebelum backfill/validasi orfan = 0 pada salinan.

## 11. Checklist pengujian pada salinan database (belum dijalankan)

> Status: BELUM DAPAT DIVERIFIKASI — saya tidak menjalankan SQL atau menyambung ke DB produksi sesuai batasan. Daftar ini untuk dijalankan penguji di salinan.

- [ ] Buat salinan DB dari backup produksi; catat versi `SELECT VERSION();`.
- [ ] Verifikasi baseline: 12 tabel ada; `admin.id` INT UNSIGNED; `media` punya `tanggal`; `produk` punya `creator` string; `pesanan` tanpa `penjual_id`.
- [ ] Dry-run tiap file revisi satu-per-satu di salinan; catat galat per statement.
- [ ] Idempotensi: jalankan tiap file 2x; run kedua harus no-op (dengan guard), bukan galat.
- [ ] INFORMATION_SCHEMA: kolom/FK/index/constraint sesuai harapan per file.
- [ ] Orfan check: produk.creator_id tanpa pasangan = 0; pembayaran duplikat idempotency = 0.
- [ ] Normalisasi transaction_id '' -> NULL sebelum UNIQUE (bila Model A).
- [ ] EXPLAIN query chat/pesanan/audit memakai index baru.
- [ ] Rollback: restore backup; verifikasi skema kembali baseline.
- [ ] Backend smoke test di salinan: baca produk/media/pesanan lama tetap tampil.

## 12. Keputusan per migrasi

| Migrasi | Keputusan | Syarat lulus |
|---|---|---|
| V1 | PERLU REVISI | Perbaiki UPDATE, ejaan baku, guard idempoten, desain owner_id eksplisit |
| V2 | PERLU REVISI | Guard idempoten, backfill tanpa username, validasi orfan = 0 di salinan |
| V3 | PERLU REVISI | Ejaan baku, model identitas diputuskan, index pesan, otorisasi aplikasi documented |
| V4 | PERLU REVISI | Model idempotency diputuskan + UNIQUE benar, FK audit diperbaiki, FK hapus diputuskan |
| V5 | PERLU REVISI | Ganti sintaks index dengan guard, buat/hapus penjual_id, hapus duplikat |
| V6 | PERLU REVISI | Hapus UPDATE salah kolom, ejaan baku, guard idempoten |

---
*Laporan selesai. Tidak ada file migrasi/skema/backend yang diubah. Tidak ada SQL yang dijalankan. Menunggu persetujuan sebelum perbaikan SQL.*
