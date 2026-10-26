-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "pengguna" VARCHAR(60) NOT NULL,
    "nama" VARCHAR(120) NOT NULL DEFAULT '',
    "email" VARCHAR(150) NOT NULL DEFAULT '',
    "sandi_hash" VARCHAR(255) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Aktif',
    "peran" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masuk_terakhir" TIMESTAMPTZ(3),
    "gagal_login" INTEGER NOT NULL DEFAULT 0,
    "terakhir_gagal_login" TIMESTAMPTZ(3),

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelanggan" (
    "id" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(120) NOT NULL DEFAULT '',
    "username" VARCHAR(60) NOT NULL DEFAULT '',
    "email" VARCHAR(150) NOT NULL,
    "sandi_hash" VARCHAR(255),
    "total_beli" BIGINT NOT NULL DEFAULT 0,
    "jumlah_pesanan" INTEGER NOT NULL DEFAULT 0,
    "bergabung" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Aktif',
    "terakhir_login" TIMESTAMPTZ(3),

    CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator" (
    "id" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "username" VARCHAR(60) NOT NULL DEFAULT '',
    "produk" INTEGER NOT NULL DEFAULT 0,
    "penjualan" INTEGER NOT NULL DEFAULT 0,
    "pendapatan" BIGINT NOT NULL DEFAULT 0,
    "bergabung" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Review',

    CONSTRAINT "creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_pengajuan" (
    "id" VARCHAR(40) NOT NULL,
    "pelanggan_id" VARCHAR(40) NOT NULL,
    "admin_id" INTEGER,
    "nama" VARCHAR(120) NOT NULL DEFAULT '',
    "email" VARCHAR(150) NOT NULL DEFAULT '',
    "username" VARCHAR(60) NOT NULL DEFAULT '',
    "whatsapp" VARCHAR(40) NOT NULL DEFAULT '',
    "catatan" VARCHAR(500) NOT NULL DEFAULT '',
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "alasan_penolakan" VARCHAR(500) NOT NULL DEFAULT '',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),
    "aktif" SMALLINT GENERATED ALWAYS AS (CASE WHEN "status" IN ('pending', 'approved') THEN 1 ELSE NULL END) STORED,

    CONSTRAINT "reseller_pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategori" (
    "id" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "deskripsi" TEXT,
    "ikon" VARCHAR(60) NOT NULL DEFAULT 'kategori',
    "gambar" VARCHAR(255) NOT NULL DEFAULT '',
    "status" VARCHAR(40) NOT NULL DEFAULT 'Aktif',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),

    CONSTRAINT "kategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produk" (
    "id" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "kategori_id" VARCHAR(40),
    "jenis" VARCHAR(30) NOT NULL DEFAULT 'Skin',
    "deskripsi_singkat" VARCHAR(300) NOT NULL DEFAULT '',
    "deskripsi_lengkap" TEXT,
    "harga" BIGINT NOT NULL DEFAULT 0,
    "harga_diskon" BIGINT NOT NULL DEFAULT 0,
    "thumbnail" VARCHAR(255) NOT NULL DEFAULT '',
    "preview" JSONB,
    "file_produk" VARCHAR(255) NOT NULL DEFAULT '',
    "versi_minecraft" VARCHAR(60) NOT NULL DEFAULT '',
    "creator" VARCHAR(120) NOT NULL DEFAULT '',
    "creator_id" VARCHAR(40),
    "status" VARCHAR(40) NOT NULL DEFAULT 'Draft',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),

    CONSTRAINT "produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo" (
    "id" VARCHAR(40) NOT NULL,
    "kode" VARCHAR(40) NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "diskon" SMALLINT NOT NULL DEFAULT 0,
    "mulai" DATE,
    "berakhir" DATE,
    "batas" INTEGER NOT NULL DEFAULT 100,
    "terpakai" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Terjadwal',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" VARCHAR(40) NOT NULL,
    "owner_tipe" VARCHAR(20),
    "owner_id" VARCHAR(40),
    "nama" VARCHAR(200) NOT NULL,
    "nama_asli" VARCHAR(200),
    "nama_simpan" VARCHAR(255),
    "jenis" VARCHAR(30) NOT NULL DEFAULT 'Thumbnail',
    "mime" VARCHAR(80) NOT NULL DEFAULT '',
    "ekstensi" VARCHAR(20),
    "ukuran" BIGINT NOT NULL DEFAULT 0,
    "checksum" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Aktif',
    "berkas" VARCHAR(255) NOT NULL DEFAULT '',
    "url" VARCHAR(255) NOT NULL DEFAULT '',
    "object_key" VARCHAR(255),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),
    "dihapus_pada" TIMESTAMPTZ(3),
    "tanggal" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produk_media" (
    "id" BIGSERIAL NOT NULL,
    "produk_id" VARCHAR(40) NOT NULL,
    "media_id" VARCHAR(40) NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "peran" VARCHAR(30) NOT NULL DEFAULT 'galeri',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produk_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesanan" (
    "id" VARCHAR(40) NOT NULL,
    "pelanggan_id" VARCHAR(40),
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
    "kode_promo" VARCHAR(40) NOT NULL DEFAULT '',
    "status" VARCHAR(40) NOT NULL DEFAULT 'Menunggu',
    "catatan" VARCHAR(255) NOT NULL DEFAULT '',
    "idempotency_key" VARCHAR(64),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),
    "dibatalkan_pada" TIMESTAMPTZ(3),
    "diselesaikan_pada" TIMESTAMPTZ(3),

    CONSTRAINT "pesanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesanan_item" (
    "id" BIGSERIAL NOT NULL,
    "pesanan_id" VARCHAR(40) NOT NULL,
    "produk_id" VARCHAR(40),
    "nama" VARCHAR(160) NOT NULL DEFAULT '',
    "harga" BIGINT NOT NULL DEFAULT 0,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),

    CONSTRAINT "pesanan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ulasan" (
    "id" VARCHAR(40) NOT NULL,
    "produk_id" VARCHAR(40),
    "produk_nama" VARCHAR(160) NOT NULL DEFAULT '',
    "pelanggan_id" VARCHAR(40),
    "pelanggan_nama" VARCHAR(120) NOT NULL DEFAULT '',
    "rating" SMALLINT NOT NULL DEFAULT 5,
    "komentar" TEXT,
    "tanggal" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Menunggu',

    CONSTRAINT "ulasan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran" (
    "id" VARCHAR(40) NOT NULL,
    "pesanan_id" VARCHAR(40) NOT NULL,
    "kode_idempotensi" VARCHAR(64) NOT NULL,
    "nominal" BIGINT NOT NULL DEFAULT 0,
    "mata_uang" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "metode" VARCHAR(60) NOT NULL DEFAULT '',
    "akun_pembayaran" VARCHAR(255) NOT NULL DEFAULT '',
    "referensi" VARCHAR(255),
    "transaction_id" VARCHAR(120),
    "status" VARCHAR(30) NOT NULL DEFAULT 'Menunggu konfirmasi',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dikonfirmasi_pada" TIMESTAMPTZ(3),
    "gagal_pada" TIMESTAMPTZ(3),
    "dikembalikan_pada" TIMESTAMPTZ(3),
    "nominal_refund" BIGINT NOT NULL DEFAULT 0,
    "konfirmasi_admin" VARCHAR(60),
    "catatan" VARCHAR(255) NOT NULL DEFAULT '',
    "diperbarui_pada" TIMESTAMPTZ(3),

    CONSTRAINT "pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran_event" (
    "id" BIGSERIAL NOT NULL,
    "pembayaran_id" VARCHAR(40) NOT NULL,
    "kode_idempotensi" VARCHAR(64) NOT NULL,
    "jenis" VARCHAR(40) NOT NULL,
    "status_saat_itu" VARCHAR(30),
    "payload_ringkas" VARCHAR(500),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "percakapan" (
    "id" VARCHAR(40) NOT NULL,
    "tipe" VARCHAR(40) NOT NULL DEFAULT 'penjualan',
    "judul" VARCHAR(200) NOT NULL DEFAULT '',
    "status" VARCHAR(40) NOT NULL DEFAULT 'open',
    "pelanggan_id" VARCHAR(40),
    "creator_id" VARCHAR(40),
    "produk_id" VARCHAR(40),
    "pesanan_id" VARCHAR(40),
    "cs_petugas_id" INTEGER,
    "pesan_terakhir_id" VARCHAR(40),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3),
    "kunci_dedup" VARCHAR(100),

    CONSTRAINT "percakapan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anggota_percakapan" (
    "id" VARCHAR(40) NOT NULL,
    "percakapan_id" VARCHAR(40) NOT NULL,
    "user_tipe" VARCHAR(20) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "peran" VARCHAR(20) NOT NULL,
    "bergabung_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keluar_pada" TIMESTAMPTZ(3),
    "terakhir_baca_pada" TIMESTAMPTZ(3),

    CONSTRAINT "anggota_percakapan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesan" (
    "id" VARCHAR(40) NOT NULL,
    "percakapan_id" VARCHAR(40) NOT NULL,
    "pengirim_tipe" VARCHAR(20) NOT NULL,
    "pengirim_id" VARCHAR(40) NOT NULL,
    "teks" TEXT,
    "tipe" VARCHAR(20) NOT NULL DEFAULT 'teks',
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMPTZ(3),
    "dihapus_pada" TIMESTAMPTZ(3),

    CONSTRAINT "pesan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesan_lampiran" (
    "id" BIGSERIAL NOT NULL,
    "pesan_id" VARCHAR(40) NOT NULL,
    "media_id" VARCHAR(40) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesan_lampiran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesan_baca" (
    "pesan_id" VARCHAR(40) NOT NULL,
    "user_tipe" VARCHAR(20) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "dibaca_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesan_baca_pkey" PRIMARY KEY ("pesan_id","user_tipe","user_id")
);

-- CreateTable
CREATE TABLE "riwayat_tontonan" (
    "id" VARCHAR(40) NOT NULL,
    "pelanggan_id" VARCHAR(40) NOT NULL,
    "video_id" VARCHAR(40) NOT NULL,
    "posisi_detik" INTEGER NOT NULL DEFAULT 0,
    "durasi_detik" INTEGER,
    "terakhir_ditonton" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progres_persen" DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN "durasi_detik" IS NULL OR "durasi_detik" = 0 THEN 0 ELSE ROUND("posisi_detik"::numeric / "durasi_detik" * 100, 2) END) STORED,
    "selesai" SMALLINT GENERATED ALWAYS AS (CASE WHEN "durasi_detik" IS NULL OR "durasi_detik" = 0 THEN 0 WHEN "posisi_detik" >= "durasi_detik" THEN 1 ELSE 0 END) STORED,

    CONSTRAINT "riwayat_tontonan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_tipe" VARCHAR(20),
    "user_id" VARCHAR(40),
    "jenis_aktivitas" VARCHAR(60) NOT NULL,
    "hasil" VARCHAR(20) NOT NULL DEFAULT 'Berhasil',
    "target_table" VARCHAR(60),
    "target_id" VARCHAR(100),
    "teks" VARCHAR(255) NOT NULL,
    "detail_json" JSONB,
    "ikon" VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
    "warna" VARCHAR(20) NOT NULL DEFAULT 'hijau',
    "alamat_ip" VARCHAR(45),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aktivitas" (
    "id" BIGSERIAL NOT NULL,
    "teks" VARCHAR(255) NOT NULL,
    "ikon" VARCHAR(40) NOT NULL DEFAULT 'centangLingkaran',
    "warna" VARCHAR(20) NOT NULL DEFAULT 'hijau',
    "admin_pengguna" VARCHAR(60),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_store" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_store_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_admin_pengguna" ON "admin"("pengguna");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pelanggan_email" ON "pelanggan"("email");

-- CreateIndex
CREATE INDEX "idx_pelanggan_username" ON "pelanggan"("username");

-- CreateIndex
CREATE INDEX "idx_pelanggan_status_bergabung" ON "pelanggan"("status", "bergabung");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_creator_nama" ON "creator"("nama");

-- CreateIndex
CREATE INDEX "idx_reseller_status_dibuat" ON "reseller_pengajuan"("status", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_reseller_pelanggan" ON "reseller_pengajuan"("pelanggan_id");

-- CreateIndex
CREATE INDEX "idx_reseller_admin" ON "reseller_pengajuan"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_reseller_pelanggan_aktif" ON "reseller_pengajuan"("pelanggan_id", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_kategori_slug" ON "kategori"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_produk_slug" ON "produk"("slug");

-- CreateIndex
CREATE INDEX "idx_produk_kategori_status" ON "produk"("kategori_id", "status");

-- CreateIndex
CREATE INDEX "idx_produk_status" ON "produk"("status");

-- CreateIndex
CREATE INDEX "idx_produk_jenis_status" ON "produk"("jenis", "status");

-- CreateIndex
CREATE INDEX "idx_produk_creator" ON "produk"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_promo_kode" ON "promo"("kode");

-- CreateIndex
CREATE INDEX "idx_promo_status" ON "promo"("status", "mulai", "berakhir");

-- CreateIndex
CREATE INDEX "idx_media_owner" ON "media"("owner_tipe", "owner_id");

-- CreateIndex
CREATE INDEX "idx_media_owner_jenis" ON "media"("owner_tipe", "owner_id", "jenis");

-- CreateIndex
CREATE INDEX "idx_media_jenis" ON "media"("jenis");

-- CreateIndex
CREATE INDEX "idx_media_dibuat" ON "media"("dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_media_status" ON "media"("status");

-- CreateIndex
CREATE INDEX "idx_produk_media_urut" ON "produk_media"("produk_id", "urutan");

-- CreateIndex
CREATE INDEX "idx_produk_media_media" ON "produk_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_produk_media" ON "produk_media"("produk_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pesanan_idempotency" ON "pesanan"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_pesanan_status_dibuat" ON "pesanan"("status", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_pesanan_email" ON "pesanan"("email");

-- CreateIndex
CREATE INDEX "idx_pesanan_dibuat" ON "pesanan"("dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_pesanan_pelanggan" ON "pesanan"("pelanggan_id", "status", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_item_pesanan" ON "pesanan_item"("pesanan_id");

-- CreateIndex
CREATE INDEX "idx_item_produk" ON "pesanan_item"("produk_id");

-- CreateIndex
CREATE INDEX "idx_item_dibuat" ON "pesanan_item"("dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_ulasan_produk_status" ON "ulasan"("produk_id", "status");

-- CreateIndex
CREATE INDEX "idx_ulasan_produk" ON "ulasan"("produk_id");

-- CreateIndex
CREATE INDEX "idx_ulasan_status" ON "ulasan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pembayaran_pesanan" ON "pembayaran"("pesanan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pembayaran_idem" ON "pembayaran"("kode_idempotensi");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pembayaran_transaction" ON "pembayaran"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_pembayaran_status" ON "pembayaran"("status", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_event_pembayaran" ON "pembayaran_event"("pembayaran_id", "dibuat_pada");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_event_idem" ON "pembayaran_event"("pembayaran_id", "kode_idempotensi", "jenis");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_percakapan_pesanan" ON "percakapan"("pesanan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_percakapan_dedup" ON "percakapan"("kunci_dedup");

-- CreateIndex
CREATE INDEX "idx_percakapan_status" ON "percakapan"("status");

-- CreateIndex
CREATE INDEX "idx_percakapan_dibuat" ON "percakapan"("dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_percakapan_pelanggan" ON "percakapan"("pelanggan_id");

-- CreateIndex
CREATE INDEX "idx_percakapan_creator" ON "percakapan"("creator_id");

-- CreateIndex
CREATE INDEX "idx_percakapan_produk" ON "percakapan"("produk_id");

-- CreateIndex
CREATE INDEX "idx_percakapan_cs_petugas" ON "percakapan"("cs_petugas_id");

-- CreateIndex
CREATE INDEX "idx_anggota_user" ON "anggota_percakapan"("user_tipe", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_anggota" ON "anggota_percakapan"("percakapan_id", "user_tipe", "user_id");

-- CreateIndex
CREATE INDEX "idx_pesan_percakapan_kirim" ON "pesan"("percakapan_id", "dibuat_pada", "id");

-- CreateIndex
CREATE INDEX "idx_pesan_pengirim" ON "pesan"("pengirim_tipe", "pengirim_id");

-- CreateIndex
CREATE INDEX "idx_lampiran_media" ON "pesan_lampiran"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_pesan_media" ON "pesan_lampiran"("pesan_id", "media_id");

-- CreateIndex
CREATE INDEX "idx_baca_user" ON "pesan_baca"("user_tipe", "user_id", "dibaca_pada");

-- CreateIndex
CREATE INDEX "idx_riwayat_pelanggan_terakhir" ON "riwayat_tontonan"("pelanggan_id", "terakhir_ditonton");

-- CreateIndex
CREATE INDEX "idx_riwayat_video" ON "riwayat_tontonan"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_riwayat_pelanggan_video" ON "riwayat_tontonan"("pelanggan_id", "video_id");

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_log"("user_tipe", "user_id", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_audit_jenis" ON "audit_log"("jenis_aktivitas", "dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_audit_target" ON "audit_log"("target_table", "target_id");

-- CreateIndex
CREATE INDEX "idx_audit_dibuat" ON "audit_log"("dibuat_pada");

-- CreateIndex
CREATE INDEX "idx_session_expire" ON "session_store"("expire");

-- AddForeignKey
ALTER TABLE "reseller_pengajuan" ADD CONSTRAINT "reseller_pengajuan_pelanggan_id_fkey" FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_pengajuan" ADD CONSTRAINT "reseller_pengajuan_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produk" ADD CONSTRAINT "produk_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produk" ADD CONSTRAINT "produk_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produk_media" ADD CONSTRAINT "produk_media_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produk_media" ADD CONSTRAINT "produk_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_pelanggan_id_fkey" FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesanan_item" ADD CONSTRAINT "pesanan_item_pesanan_id_fkey" FOREIGN KEY ("pesanan_id") REFERENCES "pesanan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulasan" ADD CONSTRAINT "ulasan_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulasan" ADD CONSTRAINT "ulasan_pelanggan_id_fkey" FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_pesanan_id_fkey" FOREIGN KEY ("pesanan_id") REFERENCES "pesanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_event" ADD CONSTRAINT "pembayaran_event_pembayaran_id_fkey" FOREIGN KEY ("pembayaran_id") REFERENCES "pembayaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "percakapan" ADD CONSTRAINT "percakapan_cs_petugas_id_fkey" FOREIGN KEY ("cs_petugas_id") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "percakapan" ADD CONSTRAINT "percakapan_pelanggan_id_fkey" FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "percakapan" ADD CONSTRAINT "percakapan_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "percakapan" ADD CONSTRAINT "percakapan_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "percakapan" ADD CONSTRAINT "percakapan_pesanan_id_fkey" FOREIGN KEY ("pesanan_id") REFERENCES "pesanan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggota_percakapan" ADD CONSTRAINT "anggota_percakapan_percakapan_id_fkey" FOREIGN KEY ("percakapan_id") REFERENCES "percakapan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesan" ADD CONSTRAINT "pesan_percakapan_id_fkey" FOREIGN KEY ("percakapan_id") REFERENCES "percakapan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesan_lampiran" ADD CONSTRAINT "pesan_lampiran_pesan_id_fkey" FOREIGN KEY ("pesan_id") REFERENCES "pesan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesan_lampiran" ADD CONSTRAINT "pesan_lampiran_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesan_baca" ADD CONSTRAINT "pesan_baca_pesan_id_fkey" FOREIGN KEY ("pesan_id") REFERENCES "pesan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_tontonan" ADD CONSTRAINT "riwayat_tontonan_pelanggan_id_fkey" FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business constraints carried forward from the PHP/MySQL schema. Keep SQL
-- migrations additive: this is a fresh PostgreSQL baseline, never a reset.
ALTER TABLE "admin" ADD CONSTRAINT "chk_admin_status" CHECK ("status" IN ('Aktif','Nonaktif'));
ALTER TABLE "pelanggan" ADD CONSTRAINT "chk_pelanggan_status" CHECK ("status" IN ('Aktif','Nonaktif'));
ALTER TABLE "creator" ADD CONSTRAINT "chk_creator_status" CHECK ("status" IN ('Aktif','Review','Ditangguhkan'));
ALTER TABLE "reseller_pengajuan" ADD CONSTRAINT "chk_reseller_status" CHECK ("status" IN ('pending','approved','rejected'));
ALTER TABLE "kategori" ADD CONSTRAINT "chk_kategori_status" CHECK ("status" IN ('Aktif','Nonaktif'));
ALTER TABLE "produk" ADD CONSTRAINT "chk_produk_status" CHECK ("status" IN ('Draft','Aktif','Nonaktif'));
ALTER TABLE "produk" ADD CONSTRAINT "chk_produk_harga" CHECK ("harga" >= 0 AND "harga_diskon" >= 0);
ALTER TABLE "produk" ADD CONSTRAINT "chk_produk_diskon_harga" CHECK ("harga_diskon" = 0 OR "harga_diskon" <= "harga");
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_status" CHECK ("status" IN ('Aktif','Terjadwal','Berakhir'));
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_diskon" CHECK ("diskon" BETWEEN 0 AND 100 AND "batas" >= 0 AND "terpakai" >= 0);
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_range_waktu" CHECK ("berakhir" IS NULL OR "mulai" IS NULL OR "berakhir" >= "mulai");
ALTER TABLE "pesanan" ADD CONSTRAINT "chk_pesanan_status" CHECK ("status" IN ('Menunggu','Diproses','Berhasil','Gagal'));
ALTER TABLE "pesanan" ADD CONSTRAINT "chk_pesanan_money" CHECK ("subtotal" >= 0 AND "biaya_layanan" >= 0 AND "potongan" >= 0 AND "total" >= 0);
ALTER TABLE "pesanan" ADD CONSTRAINT "chk_pesanan_total_reasonable" CHECK ("total" <= "subtotal" + "biaya_layanan" + 1000000);
ALTER TABLE "pesanan_item" ADD CONSTRAINT "chk_pesanan_item_money" CHECK ("harga" >= 0 AND "jumlah" >= 1 AND "subtotal" >= 0);
ALTER TABLE "ulasan" ADD CONSTRAINT "chk_ulasan_status" CHECK ("status" IN ('Menunggu','Disetujui','Disembunyikan'));
ALTER TABLE "ulasan" ADD CONSTRAINT "chk_ulasan_rating" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "pembayaran" ADD CONSTRAINT "chk_pembayaran_money" CHECK ("nominal" >= 0 AND "nominal_refund" >= 0 AND "nominal_refund" <= "nominal");
ALTER TABLE "pembayaran" ADD CONSTRAINT "chk_pembayaran_status" CHECK ("status" IN ('Menunggu konfirmasi','Dikonfirmasi','Lunas','Gagal','Dikembalikan'));
ALTER TABLE "percakapan" ADD CONSTRAINT "chk_percakapan_tipe" CHECK ("tipe" IN ('penjualan','cs'));
ALTER TABLE "percakapan" ADD CONSTRAINT "chk_percakapan_status" CHECK ("status" IN ('open','in_progress','closed'));
ALTER TABLE "riwayat_tontonan" ADD CONSTRAINT "chk_riwayat_posisi" CHECK ("posisi_detik" >= 0 AND ("durasi_detik" IS NULL OR "durasi_detik" >= 0));
ALTER TABLE "pesan" ADD CONSTRAINT "chk_pesan_teks_wajib_bila_tipe_teks" CHECK ("tipe" <> 'teks' OR CHAR_LENGTH("teks") > 0);
ALTER TABLE "anggota_percakapan" ADD CONSTRAINT "chk_anggota_bukan_null" CHECK ("user_tipe" <> '' AND "user_id" <> '');

-- Persistent replacements for the PHP security-service JSONL stores.
CREATE TABLE "security_audit_event" (
    "correlation_id" VARCHAR(40) NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "actor" VARCHAR(120),
    "action" VARCHAR(120) NOT NULL,
    "resource" VARCHAR(120),
    "outcome" VARCHAR(30) NOT NULL,
    "meta" JSONB NOT NULL,
    CONSTRAINT "security_audit_event_pkey" PRIMARY KEY ("correlation_id")
);
CREATE INDEX "idx_security_audit_ts" ON "security_audit_event"("ts");
CREATE INDEX "idx_security_audit_action_ts" ON "security_audit_event"("action", "ts");
CREATE INDEX "idx_security_audit_outcome_ts" ON "security_audit_event"("outcome", "ts");

CREATE TABLE "security_incident" (
    "id" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'detected',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB NOT NULL,
    CONSTRAINT "security_incident_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_security_incident_status" CHECK ("status" IN ('detected','investigating','contained','resolved','closed'))
);
CREATE INDEX "idx_security_incident_status_created" ON "security_incident"("status", "created_at");
CREATE INDEX "idx_security_incident_severity_created" ON "security_incident"("severity", "created_at");

CREATE TABLE "security_threat_event" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" VARCHAR(50) NOT NULL,
    "meta" JSONB NOT NULL,
    "source_id" VARCHAR(64),
    CONSTRAINT "security_threat_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_security_threat_type_ts" ON "security_threat_event"("type", "ts");
CREATE INDEX "idx_security_threat_ts" ON "security_threat_event"("ts");
CREATE UNIQUE INDEX "uniq_security_threat_source" ON "security_threat_event"("source_id");
