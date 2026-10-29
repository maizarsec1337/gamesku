



-- PENGGUNA
CREATE TABLE IF NOT EXISTS "admin" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY,
  "pengguna" VARCHAR(60) NOT NULL,
  "nama" VARCHAR(120) NOT NULL DEFAULT '',
  "email" VARCHAR(150) NOT NULL DEFAULT '',
  "sandi_hash" VARCHAR(255) NOT NULL,
  "status" VARCHAR(40) CHECK ("status" IN ('Aktif','Nonaktif')) NOT NULL DEFAULT 'Aktif',
  "peran" VARCHAR(20) NOT NULL DEFAULT 'admin',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "masuk_terakhir" TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_admin_pengguna" UNIQUE ("pengguna")
);

CREATE TABLE IF NOT EXISTS "pelanggan" (
  "id" VARCHAR(40) NOT NULL,
  "nama" VARCHAR(120) NOT NULL DEFAULT '',
  "username" VARCHAR(60) NOT NULL DEFAULT '',
  "email" VARCHAR(150) NOT NULL,
  "sandi_hash" VARCHAR(255) NULL DEFAULT NULL,
  "total_beli" BIGINT NOT NULL DEFAULT 0,
  "jumlah_pesanan" INT NOT NULL DEFAULT 0,
  "bergabung" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(40) CHECK ("status" IN ('Aktif','Nonaktif')) NOT NULL DEFAULT 'Aktif',
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_pelanggan_email" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "creator" (
  "id" VARCHAR(40) NOT NULL,
  "nama" VARCHAR(120) NOT NULL,
  "username" VARCHAR(60) NOT NULL DEFAULT '',
  "produk" INT NOT NULL DEFAULT 0,
  "penjualan" INT NOT NULL DEFAULT 0,
  "pendapatan" BIGINT NOT NULL DEFAULT 0,
  "bergabung" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(40) CHECK ("status" IN ('Aktif','Review','Ditangguhkan')) NOT NULL DEFAULT 'Review',
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_creator_nama" UNIQUE ("nama")
);

-- RESELLER: pengajuan reseller oleh pelanggan. Identitas pemohon diambil
-- dari sesi backend (bukan user_id dari request). Satu pelanggan tidak boleh
-- memiliki pengajuan pending/approved secara bersamaan (unik per status).
CREATE TABLE IF NOT EXISTS "reseller_pengajuan" (
  "id" VARCHAR(40) NOT NULL,
  "pelanggan_id" VARCHAR(40) NOT NULL,
  "admin_id" INTEGER NULL DEFAULT NULL,
  "nama" VARCHAR(120) NOT NULL DEFAULT '',
  "email" VARCHAR(150) NOT NULL DEFAULT '',
  "username" VARCHAR(60) NOT NULL DEFAULT '',
  "whatsapp" VARCHAR(40) NOT NULL DEFAULT '',
  "catatan" VARCHAR(500) NOT NULL DEFAULT '',
  "status" VARCHAR(40) CHECK ("status" IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
  "alasan_penolakan" VARCHAR(500) NOT NULL DEFAULT '',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  -- Kolom generated: 1 bila masih ada pengajuan aktif (pending/approved),
  -- NULL bila final (rejected). MySQL tidak mendukung operator ternary "? :"
  -- di generated column, pakai IF(). Unique (pelanggan_id, aktif) mencegah
  -- duplikat pending/approved; rejected berulang diperbolehkan karena NULL
  -- tidak bertentangan pada unique key di MySQL (banyak NULL = tidak duplikat).
  "aktif" SMALLINT GENERATED ALWAYS AS (CASE WHEN status IN ('pending','approved') THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_reseller_pelanggan_aktif" UNIQUE ("pelanggan_id", "aktif"),
  CONSTRAINT "fk_reseller_pelanggan"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_reseller_admin"
    FOREIGN KEY ("admin_id") REFERENCES "admin" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- PRODUK
CREATE TABLE IF NOT EXISTS "kategori" (
  "id" VARCHAR(40) NOT NULL,
  "nama" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "deskripsi" TEXT NULL,
  "ikon" VARCHAR(60) NOT NULL DEFAULT 'kategori',
  "gambar" VARCHAR(255) NOT NULL DEFAULT '',
  "status" VARCHAR(40) CHECK ("status" IN ('Aktif','Nonaktif')) NOT NULL DEFAULT 'Aktif',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_kategori_slug" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "produk" (
  "id" VARCHAR(40) NOT NULL,
  "nama" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "kategori_id" VARCHAR(40) NULL,
  "jenis" VARCHAR(30) NOT NULL DEFAULT 'Skin',
  "deskripsi_singkat" VARCHAR(300) NOT NULL DEFAULT '',
  "deskripsi_lengkap" TEXT NULL,
  "harga" BIGINT NOT NULL DEFAULT 0,
  "harga_diskon" BIGINT NOT NULL DEFAULT 0,
  CHECK ("harga" >= 0),
  CHECK ("harga_diskon" >= 0),
  "thumbnail" VARCHAR(255) NOT NULL DEFAULT '',
  "preview" JSON NULL,
  "file_produk" VARCHAR(255) NOT NULL DEFAULT '',
  "versi_minecraft" VARCHAR(60) NOT NULL DEFAULT '',
  "creator" VARCHAR(120) NOT NULL DEFAULT '',
  "creator_id" VARCHAR(40) NULL DEFAULT NULL,
  "status" VARCHAR(40) CHECK ("status" IN ('Draft','Aktif','Nonaktif')) NOT NULL DEFAULT 'Draft',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_produk_slug" UNIQUE ("slug"),
  CONSTRAINT "fk_produk_kategori"
    FOREIGN KEY ("kategori_id") REFERENCES "kategori" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fk_produk_creator"
    FOREIGN KEY ("creator_id") REFERENCES "creator" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "promo" (
  "id" VARCHAR(40) NOT NULL,
  "kode" VARCHAR(40) NOT NULL,
  "nama" VARCHAR(120) NOT NULL,
  "diskon" SMALLINT NOT NULL DEFAULT 0,
  CHECK ("diskon" BETWEEN 0 AND 100),
  "mulai" DATE NULL DEFAULT NULL,
  "berakhir" DATE NULL DEFAULT NULL,
  "batas" INT NOT NULL DEFAULT 100,
  "terpakai" INT NOT NULL DEFAULT 0,
  "status" VARCHAR(40) CHECK ("status" IN ('Aktif','Terjadwal','Berakhir')) NOT NULL DEFAULT 'Terjadwal',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_promo_kode" UNIQUE ("kode")
);

CREATE TABLE IF NOT EXISTS "media" (
  "id" VARCHAR(40) NOT NULL,
  "owner_tipe" VARCHAR(20) NULL DEFAULT NULL,
  "owner_id" VARCHAR(40) NULL DEFAULT NULL,
  "nama" VARCHAR(200) NOT NULL,
  "nama_asli" VARCHAR(200) NULL DEFAULT NULL,
  "nama_simpan" VARCHAR(255) NULL DEFAULT NULL,
  "jenis" VARCHAR(30) NOT NULL DEFAULT 'Thumbnail',
  "mime" VARCHAR(80) NOT NULL DEFAULT '',
  "ekstensi" VARCHAR(20) NULL DEFAULT NULL,
  "ukuran" BIGINT NOT NULL DEFAULT 0,
  "checksum" VARCHAR(64) NULL DEFAULT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'Aktif',
  "berkas" VARCHAR(255) NOT NULL DEFAULT '',
  "url" VARCHAR(255) NOT NULL DEFAULT '',
  "object_key" VARCHAR(255) NULL DEFAULT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  "dihapus_pada" TIMESTAMP NULL DEFAULT NULL,
  "tanggal" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "produk_media" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "produk_id" VARCHAR(40) NOT NULL,
  "media_id" VARCHAR(40) NOT NULL,
  "urutan" INTEGER NOT NULL DEFAULT 0,
  "peran" VARCHAR(30) NOT NULL DEFAULT 'galeri',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_produk_media" UNIQUE ("produk_id", "media_id"),
  CONSTRAINT "fk_produk_media_produk"
    FOREIGN KEY ("produk_id") REFERENCES "produk" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_produk_media_media"
    FOREIGN KEY ("media_id") REFERENCES "media" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- PESANAN
CREATE TABLE IF NOT EXISTS "pesanan" (
  "id" VARCHAR(40) NOT NULL,
  "pelanggan_id" VARCHAR(40) NULL,
  "pelanggan_nama" VARCHAR(120) NOT NULL DEFAULT '',
  "email" VARCHAR(150) NOT NULL DEFAULT '',
  "whatsapp" VARCHAR(40) NOT NULL DEFAULT '',
  "produk_ringkas" VARCHAR(255) NOT NULL DEFAULT '',
  "kategori" VARCHAR(120) NOT NULL DEFAULT '',
  "metode" VARCHAR(60) NOT NULL DEFAULT '',
  "subtotal" BIGINT NOT NULL DEFAULT 0,
  "biaya_layanan" BIGINT NOT NULL DEFAULT 0,
  "potongan" BIGINT NOT NULL DEFAULT 0,
  "total" BIGINT NOT NULL DEFAULT 0,
  CHECK ("subtotal" >= 0),
  CHECK ("biaya_layanan" >= 0),
  CHECK ("potongan" >= 0),
  CHECK ("total" >= 0),
  "kode_promo" VARCHAR(40) NOT NULL DEFAULT '',
  "status" VARCHAR(40) CHECK ("status" IN ('Menunggu','Diproses','Berhasil','Gagal')) NOT NULL DEFAULT 'Menunggu',
  "catatan" VARCHAR(255) NOT NULL DEFAULT '',
  "idempotency_key" VARCHAR(64) NULL DEFAULT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  "dibatalkan_pada" TIMESTAMP NULL DEFAULT NULL,
  "diselesaikan_pada" TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_pesanan_idempotency" UNIQUE ("idempotency_key"),
  CONSTRAINT "fk_pesanan_pelanggan"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pesanan_item" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "pesanan_id" VARCHAR(40) NOT NULL,
  "produk_id" VARCHAR(40) NULL,
  "nama" VARCHAR(160) NOT NULL DEFAULT '',
  "harga" BIGINT NOT NULL DEFAULT 0,
  "jumlah" INT NOT NULL DEFAULT 1,
  "subtotal" BIGINT NOT NULL DEFAULT 0,
  CHECK ("harga" >= 0),
  CHECK ("jumlah" >= 1),
  CHECK ("subtotal" >= 0),
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_item_pesanan"
    FOREIGN KEY ("pesanan_id") REFERENCES "pesanan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ulasan" (
  "id" VARCHAR(40) NOT NULL,
  "produk_id" VARCHAR(40) NULL,
  "produk_nama" VARCHAR(160) NOT NULL DEFAULT '',
  "pelanggan_id" VARCHAR(40) NULL,
  "pelanggan_nama" VARCHAR(120) NOT NULL DEFAULT '',
  "rating" SMALLINT NOT NULL DEFAULT 5,
  CHECK ("rating" BETWEEN 1 AND 5),
  "komentar" TEXT NULL,
  "tanggal" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(40) CHECK ("status" IN ('Menunggu','Disetujui','Disembunyikan')) NOT NULL DEFAULT 'Menunggu',
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_ulasan_produk"
    FOREIGN KEY ("produk_id") REFERENCES "produk" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_ulasan_pelanggan"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- PEMBAYARAN
CREATE TABLE IF NOT EXISTS "pembayaran" (
  "id" VARCHAR(40) NOT NULL,
  "pesanan_id" VARCHAR(40) NOT NULL,
  "kode_idempotensi" VARCHAR(64) NOT NULL,
  "nominal" BIGINT NOT NULL DEFAULT 0,
  "mata_uang" VARCHAR(10) NOT NULL DEFAULT 'IDR',
  CHECK ("nominal" >= 0),
  "metode" VARCHAR(60) NOT NULL DEFAULT '',
  "akun_pembayaran" VARCHAR(255) NOT NULL DEFAULT '',
  "referensi" VARCHAR(255) NULL DEFAULT NULL,
  "transaction_id" VARCHAR(120) NULL DEFAULT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'Menunggu konfirmasi',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dikonfirmasi_pada" TIMESTAMP NULL DEFAULT NULL,
  "gagal_pada" TIMESTAMP NULL DEFAULT NULL,
  "dikembalikan_pada" TIMESTAMP NULL DEFAULT NULL,
  "nominal_refund" BIGINT NOT NULL DEFAULT 0,
  CHECK ("nominal_refund" >= 0),
  "konfirmasi_admin" VARCHAR(60) NULL DEFAULT NULL,
  "catatan" VARCHAR(255) NOT NULL DEFAULT '',
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_pembayaran_pesanan" UNIQUE ("pesanan_id"),
  CONSTRAINT "uniq_pembayaran_idem" UNIQUE ("kode_idempotensi"),
  CONSTRAINT "uniq_pembayaran_transaction" UNIQUE ("transaction_id"),
  CONSTRAINT "fk_pembayaran_pesanan"
    FOREIGN KEY ("pesanan_id") REFERENCES "pesanan" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pembayaran_event" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "pembayaran_id" VARCHAR(40) NOT NULL,
  "kode_idempotensi" VARCHAR(64) NOT NULL,
  "jenis" VARCHAR(40) NOT NULL,
  "status_saat_itu" VARCHAR(30) NULL DEFAULT NULL,
  "payload_ringkas" VARCHAR(500) NULL DEFAULT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_event_idem" UNIQUE ("pembayaran_id", "kode_idempotensi", "jenis"),
  CONSTRAINT "fk_event_pembayaran"
    FOREIGN KEY ("pembayaran_id") REFERENCES "pembayaran" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- CHAT
CREATE TABLE IF NOT EXISTS "percakapan" (
  "id" VARCHAR(40) NOT NULL,
  "tipe" VARCHAR(40) CHECK ("tipe" IN ('penjualan','cs')) NOT NULL DEFAULT 'penjualan',
  "judul" VARCHAR(200) NOT NULL DEFAULT '',
  "status" VARCHAR(40) CHECK ("status" IN ('open','in_progress','closed')) NOT NULL DEFAULT 'open',
  "pelanggan_id" VARCHAR(40) NULL,
  "creator_id" VARCHAR(40) NULL,
  "produk_id" VARCHAR(40) NULL,
  "pesanan_id" VARCHAR(40) NULL,
  "cs_petugas_id" INTEGER NULL,
  "pesan_terakhir_id" VARCHAR(40) NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbarui_pada" TIMESTAMP NULL DEFAULT NULL ,
  "kunci_dedup" VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_percakapan_dedup" UNIQUE ("kunci_dedup"),
  CONSTRAINT "uniq_percakapan_pesanan" UNIQUE ("pesanan_id"),
  CONSTRAINT "fk_percakapan_pelanggan"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_percakapan_creator"
    FOREIGN KEY ("creator_id") REFERENCES "creator" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_percakapan_produk"
    FOREIGN KEY ("produk_id") REFERENCES "produk" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fk_percakapan_pesanan"
    FOREIGN KEY ("pesanan_id") REFERENCES "pesanan" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fk_percakapan_cs_petugas"
    FOREIGN KEY ("cs_petugas_id") REFERENCES "admin" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "anggota_percakapan" (
  "id" VARCHAR(40) NOT NULL,
  "percakapan_id" VARCHAR(40) NOT NULL,
  "user_tipe" VARCHAR(20) NOT NULL,
  "user_id" VARCHAR(40) NOT NULL,
  "peran" VARCHAR(20) NOT NULL,
  "bergabung_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "keluar_pada" TIMESTAMP NULL DEFAULT NULL,
  "terakhir_baca_pada" TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_anggota" UNIQUE ("percakapan_id", "user_tipe", "user_id"),
  CONSTRAINT "fk_anggota_percakapan"
    FOREIGN KEY ("percakapan_id") REFERENCES "percakapan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pesan" (
  "id" VARCHAR(40) NOT NULL,
  "percakapan_id" VARCHAR(40) NOT NULL,
  "pengirim_tipe" VARCHAR(20) NOT NULL,
  "pengirim_id" VARCHAR(40) NOT NULL,
  "teks" TEXT NULL,
  "tipe" VARCHAR(20) NOT NULL DEFAULT 'teks',
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diubah_pada" TIMESTAMP NULL DEFAULT NULL ,
  "dihapus_pada" TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_pesan_percakapan"
    FOREIGN KEY ("percakapan_id") REFERENCES "percakapan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pesan_lampiran" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "pesan_id" VARCHAR(40) NOT NULL,
  "media_id" VARCHAR(40) NOT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_pesan_media" UNIQUE ("pesan_id", "media_id"),
  CONSTRAINT "fk_lampiran_pesan"
    FOREIGN KEY ("pesan_id") REFERENCES "pesan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_lampiran_media"
    FOREIGN KEY ("media_id") REFERENCES "media" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pesan_baca" (
  "pesan_id" VARCHAR(40) NOT NULL,
  "user_tipe" VARCHAR(20) NOT NULL,
  "user_id" VARCHAR(40) NOT NULL,
  "dibaca_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("pesan_id", "user_tipe", "user_id"),
  CONSTRAINT "fk_baca_pesan"
    FOREIGN KEY ("pesan_id") REFERENCES "pesan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- LAINNYA
CREATE TABLE IF NOT EXISTS "riwayat_tontonan" (
  "id" VARCHAR(40) NOT NULL,
  "pelanggan_id" VARCHAR(40) NOT NULL,
  "video_id" VARCHAR(40) NOT NULL,
  "posisi_detik" INTEGER NOT NULL DEFAULT 0,
  "durasi_detik" INTEGER NULL DEFAULT NULL,
  "terakhir_ditonton" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,
  "progres_persen" DECIMAL(5,2)
    GENERATED ALWAYS AS (
      CASE
        WHEN "durasi_detik" IS NULL OR "durasi_detik" = 0 THEN 0
        ELSE ROUND("posisi_detik" / "durasi_detik" * 100, 2)
      END
    ) STORED,
  "selesai" SMALLINT(1)
    GENERATED ALWAYS AS (
      CASE
        WHEN "durasi_detik" IS NULL OR "durasi_detik" = 0 THEN 0
        WHEN "posisi_detik" >= "durasi_detik" THEN 1
        ELSE 0
      END
    ) STORED,
  PRIMARY KEY ("id"),
  CONSTRAINT "uniq_riwayat_pelanggan_video" UNIQUE ("pelanggan_id", "video_id"),
  CONSTRAINT "fk_riwayat_pelanggan"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- AUDIT
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "user_tipe" VARCHAR(20) NULL DEFAULT NULL,
  "user_id" VARCHAR(40) NULL DEFAULT NULL,
  "jenis_aktivitas" VARCHAR(60) NOT NULL,
  "hasil" VARCHAR(20) NOT NULL DEFAULT 'Berhasil',
  "target_table" VARCHAR(60) NULL DEFAULT NULL,
  "target_id" VARCHAR(100) NULL DEFAULT NULL,
  "teks" VARCHAR(255) NOT NULL,
  "detail_json" JSON NULL,
  "ikon" VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  "warna" VARCHAR(20) NOT NULL DEFAULT 'hijau',
  "alamat_ip" VARCHAR(45) NULL DEFAULT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aktivitas" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY,
  "teks" VARCHAR(255) NOT NULL,
  "ikon" VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
  "warna" VARCHAR(20) NOT NULL DEFAULT 'hijau',
  "admin_pengguna" VARCHAR(60) NULL DEFAULT NULL,
  "dibuat_pada" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

SELECT
    "id" AS "pesanan_id",
    "pelanggan_id",
    "pelanggan_nama",
    "produk_ringkas",
    "total",
    "status",
    "kode_promo",
    "catatan",
    "dibuat_pada",
    "diperbarui_pada"
FROM "pesanan"
WHERE "status" IN ('Menunggu', 'Diproses', 'Gagal')
ORDER BY "dibuat_pada" DESC;

-- ============================================================================
-- VIEW: pembayaran yang menunggu konfirmasi
-- ============================================================================
SELECT
    "id" AS "pembayaran_id",
    "pesanan_id",
    "nominal",
    "metode",
    "akun_pembayaran",
    "dibuat_pada",
    "diperbarui_pada"
FROM "pembayaran"
WHERE "status" = 'Menunggu konfirmasi'
ORDER BY "dibuat_pada" ASC;

-- ============================================================================
-- VIEW: audit log kegagalan (untuk investigasi keamanan)
-- ============================================================================
SELECT
    "id",
    "user_tipe",
    "user_id",
    "jenis_aktivitas",
    "target_table",
    "target_id",
    "detail_json",
    "alamat_ip",
    "dibuat_pada"
FROM "audit_log"
WHERE "hasil" <> 'Berhasil'
  AND "jenis_aktivitas" IN (
      'login_gagal',
      'ganti_status_pesanan',
      'hapus_produk',
      'ulkah_edit',
      'ukur_harga',
      'atur_reseller'
  )
ORDER BY "dibuat_pada" DESC;
-- ============================================================================
-- INDEX TAMBAHAN untuk performa query umum
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_pesanan_status_dibuat"
  ON "pesanan" ("status", "dibuat_pada");

CREATE INDEX IF NOT EXISTS "idx_pembayaran_status_dibuat"
  ON "pembayaran" ("status", "dibuat_pada");

CREATE INDEX IF NOT EXISTS "idx_ulasan_status_produk"
  ON "ulasan" ("produk_id", "status");

CREATE INDEX IF NOT EXISTS "idx_riwayat_video_terakhir"
  ON "riwayat_tontonan" ("video_id", "terakhir_ditonton");





-- ============================================================================
-- SEMUA TRIGGER DITERUSKAN KE BACKEND PHP
-- ==========================================================================--
-- InfinityFree shared MySQL tidak memberi hak TRIGGER (error #1142),
-- sehingga semua audit log status/profil sekarang ditulis oleh aplikasi
-- melalui Aktivitas::audit() yang dipanggil di dalam Database::transaksi().
-- Desain ini memastikan atomicity: UPDATE + audit terjadi bersama-sama,
-- atau jika audit gagal, transaksi digulirkan untuk menjaga konsistensi.
--
-- Peta logika yang dipindahkan:
--   trg_pesanan_after_update     -> audit ubah_status_pesanan     (PengendaliPesanan::ubahStatus)
--   trg_pembayaran_after_update  -> audit ubah_status_pembayaran  (PengendaliPembayaran::ubah)
--   trg_produk_after_update      -> audit ubah_status_produk    (PengendaliProduk::simpan)
--   trg_admin_after_update       -> audit ubah_status_admin     (PengendaliAuth::ubahAdmin)
--   trg_ulasan_after_insert      -> validasi auto-approve rating>=4 (PengendaliUlasan::kirim)
--
-- Migrasi M0 (database/migrasi.php) menjalankan DROP TRIGGER IF EXISTS
-- untuk 5 trigger lama bersifat idempoten (bisa dijalankan berkali-kali).
-- SETANA LINTAS: SETELAH schema.sql diterapkan di DB, migrasi M0 bisa
-- dijalankan untuk membersihkan trigger lama yang masih ada.
--
-- +++ PERBAikan F-V5-04: SEMUA CHECK CONSTRAINT TAMBAHAN IDempotent +++
-- Semua ALTER TABLE ADD CONSTRAINT CHECK di-selenggarai dengan IF NOT EXISTS
-- agar skema dapat dieksekusi berulang kali tanpa error "Duplicate CHECK constraint".
-- Lihat setiap constraint di bawah ini (baris 610-670).
-- ============================================================================



-- ============================================================================
-- PENINGKATAN KETERECANAAN & INTEGRITAS DATA
-- (tambahan ALTER TABLE untuk tabel yang ada)
-- ============================================================================


-- Indeks tambahan (dikonversi dari MySQL KEY)
CREATE INDEX IF NOT EXISTS "idx_pelanggan_username" ON "pelanggan" ("username");
CREATE INDEX IF NOT EXISTS "idx_pelanggan_status_bergabung" ON "pelanggan" ("status", "bergabung");
CREATE INDEX IF NOT EXISTS "idx_reseller_status_dibuat" ON "reseller_pengajuan" ("status", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_reseller_pelanggan" ON "reseller_pengajuan" ("pelanggan_id");
CREATE INDEX IF NOT EXISTS "idx_reseller_admin" ON "reseller_pengajuan" ("admin_id");
CREATE INDEX IF NOT EXISTS "idx_produk_kategori_status" ON "produk" ("kategori_id", "status");
CREATE INDEX IF NOT EXISTS "idx_produk_status" ON "produk" ("status");
CREATE INDEX IF NOT EXISTS "idx_produk_jenis_status" ON "produk" ("jenis", "status");
CREATE INDEX IF NOT EXISTS "idx_produk_creator" ON "produk" ("creator_id");
CREATE INDEX IF NOT EXISTS "idx_promo_status" ON "promo" ("status", "mulai", "berakhir");
CREATE INDEX IF NOT EXISTS "idx_media_jenis" ON "media" ("jenis");
CREATE INDEX IF NOT EXISTS "idx_media_owner" ON "media" ("owner_tipe", "owner_id");
CREATE INDEX IF NOT EXISTS "idx_media_owner_jenis" ON "media" ("owner_tipe", "owner_id", "jenis");
CREATE INDEX IF NOT EXISTS "idx_media_dibuat" ON "media" ("dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_media_status" ON "media" ("status");
CREATE INDEX IF NOT EXISTS "idx_produk_media_urut" ON "produk_media" ("produk_id", "urutan");
CREATE INDEX IF NOT EXISTS "idx_produk_media_media" ON "produk_media" ("media_id");
CREATE INDEX IF NOT EXISTS "idx_pesanan_status_dibuat" ON "pesanan" ("status", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_pesanan_dibuat" ON "pesanan" ("dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_pesanan_email" ON "pesanan" ("email");
CREATE INDEX IF NOT EXISTS "idx_pesanan_pelanggan" ON "pesanan" ("pelanggan_id", "status", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_item_pesanan" ON "pesanan_item" ("pesanan_id");
CREATE INDEX IF NOT EXISTS "idx_item_produk" ON "pesanan_item" ("produk_id");
CREATE INDEX IF NOT EXISTS "idx_item_dibuat" ON "pesanan_item" ("dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_ulasan_produk" ON "ulasan" ("produk_id");
CREATE INDEX IF NOT EXISTS "idx_ulasan_produk_status" ON "ulasan" ("produk_id", "status");
CREATE INDEX IF NOT EXISTS "idx_ulasan_status" ON "ulasan" ("status");
CREATE INDEX IF NOT EXISTS "idx_pembayaran_status" ON "pembayaran" ("status", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_event_pembayaran" ON "pembayaran_event" ("pembayaran_id", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_percakapan_status" ON "percakapan" ("status");
CREATE INDEX IF NOT EXISTS "idx_percakapan_dibuat" ON "percakapan" ("dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_percakapan_pelanggan" ON "percakapan" ("pelanggan_id");
CREATE INDEX IF NOT EXISTS "idx_percakapan_creator" ON "percakapan" ("creator_id");
CREATE INDEX IF NOT EXISTS "idx_percakapan_produk" ON "percakapan" ("produk_id");
CREATE INDEX IF NOT EXISTS "idx_percakapan_cs_petugas" ON "percakapan" ("cs_petugas_id");
CREATE INDEX IF NOT EXISTS "idx_anggota_user" ON "anggota_percakapan" ("user_tipe", "user_id");
CREATE INDEX IF NOT EXISTS "idx_pesan_percakapan_kirim" ON "pesan" ("percakapan_id", "dibuat_pada", "id");
CREATE INDEX IF NOT EXISTS "idx_pesan_pengirim" ON "pesan" ("pengirim_tipe", "pengirim_id");
CREATE INDEX IF NOT EXISTS "idx_lampiran_media" ON "pesan_lampiran" ("media_id");
CREATE INDEX IF NOT EXISTS "idx_baca_user" ON "pesan_baca" ("user_tipe", "user_id", "dibaca_pada");
CREATE INDEX IF NOT EXISTS "idx_riwayat_pelanggan_terakhir" ON "riwayat_tontonan" ("pelanggan_id", "terakhir_ditonton");
CREATE INDEX IF NOT EXISTS "idx_riwayat_video" ON "riwayat_tontonan" ("video_id");
CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_log" ("user_tipe", "user_id", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_audit_jenis" ON "audit_log" ("jenis_aktivitas", "dibuat_pada");
CREATE INDEX IF NOT EXISTS "idx_audit_target" ON "audit_log" ("target_table", "target_id");
CREATE INDEX IF NOT EXISTS "idx_audit_dibuat" ON "audit_log" ("dibuat_pada");

-- ============================================================================
-- TAMBAHAN INTEGRITAS (setara tail schema.sql)
-- ============================================================================

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "gagal_login" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "terakhir_gagal_login" TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE "pelanggan"
  ADD COLUMN IF NOT EXISTS "terakhir_login" TIMESTAMP NULL DEFAULT NULL;

ALTER TABLE "produk"
  ADD CONSTRAINT "chk_produk_diskon_harga"
    CHECK ("harga_diskon" = 0 OR "harga_diskon" <= "harga");

ALTER TABLE "promo"
  ADD CONSTRAINT "chk_promo_range_waktu"
    CHECK ("berakhir" IS NULL OR "mulai" IS NULL OR "berakhir" >= "mulai");

ALTER TABLE "pesanan"
  ADD CONSTRAINT "chk_pesanan_total_reasonable"
    CHECK ("total" <= "subtotal" + "biaya_layanan" + 1000000);

ALTER TABLE "pembayaran"
  ADD CONSTRAINT "chk_pembayaran_refund_bukan_lebih"
    CHECK ("nominal_refund" <= "nominal");

ALTER TABLE "riwayat_tontonan"
  ADD CONSTRAINT "chk_riwayat_posisi_bawah_durasi"
    CHECK ("posisi_detik" <= COALESCE("durasi_detik", POWER(2, 32) - 1));

ALTER TABLE "pesan"
  ADD CONSTRAINT "chk_pesan_teks_wajib_bila_tipe_teks"
    CHECK ("tipe" <> 'teks' OR (CHAR_LENGTH("teks") > 0));

ALTER TABLE "anggota_percakapan"
  ADD CONSTRAINT "chk_anggota_bukan_null"
    CHECK ("user_tipe" <> '' AND "user_id" <> '');

