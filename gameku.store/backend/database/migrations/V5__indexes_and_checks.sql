-- ============================================================
-- V5__indexes_and_checks.sql (FINAL — aman dijalankan ulang)
-- Target: MySQL 5.7+ / MariaDB 10.2+, InnoDB, utf8mb4
-- Sifat: idempoten via guard INFORMATION_SCHEMA. Run kedua = no-op
--   (atau konvergen ke state sama tanpa galat).
-- Perbaikan dari review + verifikasi skema aktual:
--   F-V5-01: TANPA "CREATE INDEX IF NOT EXISTS" (sintaks tidak valid).
--     Semua index memakai prosedur guard __v5_ensure_index.
--   F-V5-02: TIDAK menyentuh pesanan.penjual_id (kolom tidak ada).
--     Penjual diturunkan via join pesanan_item->produk->creator (lihat V7).
--   F-V5-03: TANPA duplikat V1/V2/V4 (idx_media_*, idx_produk_creator,
--     idx_audit_* sudah di migrasinya masing-masing).
--   F-V5-04: CHECK memakai guard + lolos-data-lama (hanya dipasang bila
--     nol baris melanggar).
--   Nama aktual yang dipakai (hasil baca skema.sql nyata):
--     promo: mulai/berakhir/batas/terpakai (BUKAN tanggal_mulai/batas_pakai)
--     pesanan_item: idx_item_pesanan/idx_item_produk (BUKAN idx_pesanan_item_*)
--     ulasan: kolom rating (BUKAN bintang)
-- Catatan versi: CHECK diabaikan MySQL 5.7, ditegakkan MariaDB 10.2+ dan
--   MySQL 8.0.16+. Validasi tetap di aplikasi.
-- Tidak ada data demo. Tidak ada rahasia koneksi.
-- ============================================================

DROP PROCEDURE IF EXISTS `__v5_ensure_index`;
DROP PROCEDURE IF EXISTS `__v5_ensure_check`;

DELIMITER $$

-- Penjaga index generik: tambah bila belum ada; perbaiki bila definisi beda.
CREATE PROCEDURE `__v5_ensure_index`(
  IN p_tabel VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_kolom VARCHAR(255),
  IN p_kolom_csv VARCHAR(255)
)
BEGIN
  DECLARE v_ada INT DEFAULT 0;
  DECLARE v_defsaatini TEXT DEFAULT NULL;
  SELECT COUNT(*) INTO v_ada
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_tabel
    AND INDEX_NAME = p_index;
  IF v_ada = 0 THEN
    SET @__v5_sql = CONCAT(
      'ALTER TABLE `', p_tabel, '` ADD INDEX `', p_index, '` (', p_kolom, ')'
    );
    PREPARE __v5_stmt FROM @__v5_sql;
    EXECUTE __v5_stmt;
    DEALLOCATE PREPARE __v5_stmt;
  ELSE
    SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)
    INTO v_defsaatini
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_tabel
      AND INDEX_NAME = p_index;
    IF v_defsaatini <> p_kolom_csv THEN
      SET @__v5_drop = CONCAT(
        'ALTER TABLE `', p_tabel, '` DROP INDEX `', p_index, '`'
      );
      PREPARE __v5_dropstmt FROM @__v5_drop;
      EXECUTE __v5_dropstmt;
      DEALLOCATE PREPARE __v5_dropstmt;
      SET @__v5_sql = CONCAT(
        'ALTER TABLE `', p_tabel, '` ADD INDEX `', p_index, '` (', p_kolom, ')'
      );
      PREPARE __v5_stmt FROM @__v5_sql;
      EXECUTE __v5_stmt;
      DEALLOCATE PREPARE __v5_stmt;
    END IF;
  END IF;
END$$

-- Penjaga CHECK: pasang hanya bila belum ada DAN nol baris melanggar.
CREATE PROCEDURE `__v5_ensure_check`(
  IN p_tabel VARCHAR(64),
  IN p_nama VARCHAR(64),
  IN p_expr TEXT,
  IN p_where_langgar TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_tabel
      AND CONSTRAINT_NAME = p_nama
  ) THEN
    SET @__v5_cek = CONCAT(
      'SELECT COUNT(*) INTO @__v5_jml FROM `', p_tabel, '` WHERE ', p_where_langgar
    );
    PREPARE __v5_cekstmt FROM @__v5_cek;
    EXECUTE __v5_cekstmt;
    DEALLOCATE PREPARE __v5_cekstmt;
    IF @__v5_jml = 0 THEN
      SET @__v5_sql = CONCAT(
        'ALTER TABLE `', p_tabel, '` ADD CONSTRAINT `', p_nama, '` CHECK (', p_expr, ')'
      );
      PREPARE __v5_stmt FROM @__v5_sql;
      EXECUTE __v5_stmt;
      DEALLOCATE PREPARE __v5_stmt;
    END IF;
  END IF;
END$$

DELIMITER ;

-- 1. Index query nyata (nama + kolom sesuai skema aktual)
CALL `__v5_ensure_index`('produk', 'idx_produk_kategori_status', '`kategori_id`, `status`', 'kategori_id,status');
CALL `__v5_ensure_index`('pesanan', 'idx_pesanan_pelanggan', '`pelanggan_id`, `status`, `dibuat_pada`', 'pelanggan_id,status,dibuat_pada');
CALL `__v5_ensure_index`('ulasan', 'idx_ulasan_produk_status', '`produk_id`, `status`', 'produk_id,status');
CALL `__v5_ensure_index`('promo', 'idx_promo_status', '`status`, `mulai`, `berakhir`', 'status,mulai,berakhir');

-- 2. CHECK integritas (dilewati otomatis bila data lama melanggar)
CALL `__v5_ensure_check`('ulasan', 'chk_ulasan_bintang',
  '`rating` BETWEEN 1 AND 5',
  '`rating` NOT BETWEEN 1 AND 5');
CALL `__v5_ensure_check`('pesanan_item', 'chk_item_jumlah',
  '`jumlah` >= 1',
  '`jumlah` < 1');
CALL `__v5_ensure_check`('promo', 'chk_promo_pakai',
  '`terpakai` >= 0 AND `batas` >= 0',
  '`terpakai` < 0 OR `batas` < 0');

-- 3. Validasi manual di salinan (SELECT saja, jalankan penguji):
-- SELECT COUNT(*) AS langgar_rating FROM ulasan WHERE rating NOT BETWEEN 1 AND 5;
-- SELECT COUNT(*) AS langgar_jumlah FROM pesanan_item WHERE jumlah < 1;
-- SELECT COUNT(*) AS langgar_promo FROM promo WHERE terpakai < 0 OR batas < 0;

-- 4. Bersih-bersih
DROP PROCEDURE IF EXISTS `__v5_ensure_index`;
DROP PROCEDURE IF EXISTS `__v5_ensure_check`;
