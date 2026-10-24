'use strict';
// Uji impor + perilaku skema chat Gameku.store (penerjemah MySQL -> SQLite).
// Hapus file ini setelah dipakai; bukan bagian dari produk.
const fs = require('fs');
const SQLJS = 'c:/Users/maizar/Documents/gamesku/gameku.store/node_modules/sql.js';
const PATH  = 'c:/Users/maizar/Documents/gamesku/gameku.store/backend/database/skema.sql';
const initSqlJs = require(SQLJS);

let lulus = 0, gagal = 0;
const ok = (nama, cond, ket) => {
  if (cond) { lulus++; console.log('LULUS  ' + nama + (ket ? '  [' + ket + ']' : '')); }
  else      { gagal++; console.log('GAGAL  ' + nama + (ket ? '  [' + ket + ']' : '')); }
};

// ---------- 1. Pemeriksaan statis pada teks asli ----------
function statis(raw) {
  ok('21 CREATE TABLE', (raw.match(/CREATE TABLE IF NOT EXISTS `/g) || []).length === 21);
  ok('21 FOREIGN KEY', (raw.match(/FOREIGN KEY/g) || []).length === 21);
  ok('16 UNIQUE KEY', (raw.match(/UNIQUE KEY/g) || []).length === 16);
  ok('16 CHECK', (raw.match(/ CHECK \(/g) || []).length === 16);
  ok('39 KEY indeks biasa', (raw.match(/^  KEY /gm) || []).length === 39);
  ok('tanpa INSERT INTO', !/INSERT INTO/i.test(raw));
  ok('tanpa GRANT/IDENTIFIED BY/CREATE DATABASE/USE',
     !/(GRANT |IDENTIFIED BY|CREATE DATABASE|^USE `)/im.test(raw));
  ok('tanpa STORED NULL / STORED NOT NULL (ditolak MariaDB)',
     !/STORED (NULL|NOT NULL)/.test(raw));
  ok('admin.paran ada', /`peran`\s+VARCHAR\(20\) NOT NULL DEFAULT 'admin'/.test(raw));
  ok('kunci_dedup generated + UNIQUE', /`kunci_dedup`\s+VARCHAR\(100\) GENERATED ALWAYS AS/.test(raw)
     && /UNIQUE KEY `uniq_percakapan_dedup`/.test(raw));
  ok('FK komposit pengirim -> anggota',
     /FOREIGN KEY \(`percakapan_id`, `pengirim_tipe`, `pengirim_id`\)\s+REFERENCES `anggota_percakapan`/.test(raw));
  ok('status cs open|in_progress|closed',
     /ENUM\('open','in_progress','closed'\)/.test(raw));
  ok('tipe penjualan|cs', /ENUM\('penjualan','cs'\)/.test(raw));
}

// ---------- 2. Penerjemah MySQL -> SQLite ----------
function buangKomentarEkor(ln) {
  let inq = false;
  for (let i = 0; i < ln.length - 1; i++) {
    const ch = ln[i];
    if (ch === "'") { if (inq && ln[i + 1] === "'") { i++; continue; } inq = !inq; }
    else if (!inq && ch === '-' && ln[i + 1] === '-') return ln.slice(0, i);
  }
  return ln;
}
function pisahPernyataan(t) {
  const hasil = []; let cur = ''; let inq = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inq) {
      if (ch === "'") { if (t[i + 1] === "'") { cur += "''"; i++; } else { inq = false; cur += ch; } }
      else cur += ch;
    } else if (ch === "'") { inq = true; cur += ch; }
    else if (ch === ';') { hasil.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) hasil.push(cur);
  return hasil;
}
function terjemah(sql) {
  const garis = [];
  for (let ln of sql.split('\n')) {
    ln = ln.replace(/\r$/, '');
    if (/^\s*--/.test(ln)) continue;
    ln = buangKomentarEkor(ln);
    if (ln.trim()) garis.push(ln);
  }
  const keluar = [], indeks = [];
  for (let s of pisahPernyataan(garis.join('\n'))) {
    s = s.trim();
    if (!s || /^\s*SET\s/i.test(s)) continue;          // SET NAMES / FOREIGN_KEY_CHECKS
    const m = s.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/);
    const tabel = m ? m[1] : null;
    let auto = false;
    s = s.replace(/`(\w+)`\s+(?:BIGINT|INT)(?:\s+UNSIGNED)?\s+NOT NULL AUTO_INCREMENT/g,
      (_x, kol) => { auto = true; return '`' + kol + '` INTEGER PRIMARY KEY AUTOINCREMENT'; });
    if (tabel) s = s.replace(/^\s*KEY\s+`(\w+)`\s*\(([^)]*)\),?\s*$/gm, (_x, n, k) => {
      indeks.push({ tabel, nama: n, kolom: k }); return '';
    });
    if (auto) {
      s = s.replace(/^\s*PRIMARY KEY\s*\(`\w+`\),?\s*\n/gm, '');
      s = s.replace(/,\s*\)/, ')');
    }
    s = s.replace(/\s+ON UPDATE CURRENT_TIMESTAMP/g, '');
    s = s.replace(/COMMENT\s+'(?:[^']|'')*'/g, '');
    s = s.replace(/UNIQUE KEY\s+`(\w+)`\s*\(/g, 'CONSTRAINT `$1` UNIQUE (');
    s = s.replace(/\bENUM\s*\([^)]*\)/g, 'TEXT');
    s = s.replace(/\bTINYINT\(1\)/g, 'INTEGER');
    s = s.replace(/\b(?:BIGINT|TINYINT|SMALLINT|MEDIUMINT|INT)\b/g, 'INTEGER');
    s = s.replace(/\bUNSIGNED\b/g, '');
    s = s.replace(/\bAUTO_INCREMENT\b/g, '');
    s = s.replace(/\bDECIMAL\s*\(/gi, 'NUMERIC(');
    s = s.replace(/\bJSON\b/g, 'TEXT');
    // Padanan builtin SQLite (semua deterministik -> sah di generated column):
    s = s.replace(/\bLEAST\s*\(/g, 'MIN(');
    s = s.replace(/\bGREATEST\s*\(/g, 'MAX(');
    s = s.replace(/\bIF\s*\(/g, 'iif(');
    s = s.replace(/`posisi_detik` \/ `durasi_detik`/g, '`posisi_detik` * 1.0 / `durasi_detik`');
    s = ubahConcat(s);
    s = s.replace(/\s*ENGINE=InnoDB.*$/m, '');
    s = s.replace(/DEFAULT CHARSET=\w+\s*COLLATE=\w+/, '');
    if (/UNSIGNED|AUTO_INCREMENT|ENGINE=|CHARSET=/.test(s)) console.log('  ! sisa MySQL:', s.slice(0, 90));
    keluar.push(s + ';');
  }
  for (const i of indeks) {
    keluar.push('CREATE INDEX IF NOT EXISTS `' + i.nama + '` ON `' + i.tabel + '` (' + i.kolom + ');');
  }
  return keluar;
}

// CONCAT(a,b,..) -> (a || b || ..) [SQLite: CONCAT bukan builtin di versi lama]
function ubahConcat(t) {
  const buka = 'CONCAT(';
  let i = t.indexOf(buka);
  while (i >= 0) {
    let d = 0, inq = false, akhir = -1;
    const arg = []; let cur = '';
    for (let k = i + buka.length - 1; k < t.length; k++) {
      const ch = t[k];
      if (inq) { cur += ch; if (ch === "'") inq = false; continue; }
      if (ch === "'") { inq = true; cur += ch; continue; }
      if (ch === '(') { d++; if (d === 1) continue; cur += ch; continue; }
      if (ch === ')') { d--; if (d === 0) { arg.push(cur); akhir = k; break; } cur += ch; continue; }
      if (ch === ',' && d === 1) { arg.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (akhir < 0) throw new Error('CONCAT tak seimbang di posisi ' + i);
    const ganti = '(' + arg.map(a => a.trim()).join(' || ') + ')';
    t = t.slice(0, i) + ganti + t.slice(akhir + 1);
    i = t.indexOf(buka, i);
  }
  return t;
}

// ---------- 3. Impor penuh + uji perilaku ----------
async function main() {
  const raw = fs.readFileSync(PATH, 'utf8');
  statis(raw);
  const pernyataan = terjemah(raw);
  const SQL = await initSqlJs({ locateFile: f => SQLJS + '/dist/' + f });
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  console.log('SQLite ' + db.exec('SELECT sqlite_version()')[0].values[0][0]);
  try { db.exec('SELECT iif(1,2,3), MIN(1,2), MAX(1,2)'); }
  catch (e) { throw new Error('SQLite tanpa iif/MIN/MAX skalar: ' + e.message); }

  let imporGagal = 0;
  pernyataan.forEach((s, i) => { try { db.run(s); }
    catch (e) { imporGagal++; console.log('  ! impor #' + i + ': ' + e.message + ' | ' + s.slice(0, 90).replace(/\n/g, ' ')); } });
  ok('impor penuh tanpa galat', imporGagal === 0, imporGagal + ' galat');

  const q1  = sql => { const r = db.exec(sql); return (r.length && r[0].values.length) ? r[0].values[0][0] : null; };
  const jml = sql => q1(sql);
  const coba = sql => db.exec(sql);
  const harapGagal = (nama, sql) => {
    try { db.exec(sql); ok(nama, false, 'TIDAK ditolak oleh DB'); }
    catch (e) { ok(nama, true, e.message.slice(0, 70)); }
  };

  ok('21 tabel terbentuk', jml("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") === 21);

  // ---- benih ----
  db.run("INSERT INTO admin (pengguna,nama,email,sandi_hash) VALUES ('cs1','CS Satu','cs1@x.co','h')");
  db.run("INSERT INTO admin (pengguna,nama,email,sandi_hash,peran) VALUES ('cs2','CS Dua','cs2@x.co','h','cs')");
  const A1 = q1("SELECT id FROM admin WHERE pengguna='cs1'");
  const A2 = q1("SELECT id FROM admin WHERE pengguna='cs2'");
  ok('admin.peran DEFAULT admin', q1("SELECT peran FROM admin WHERE pengguna='cs1'") === 'admin');
  harapGagal('admin.peran tak sah ditolak CHECK',
    "INSERT INTO admin (pengguna,nama,email,sandi_hash,peran) VALUES ('x','x','x@x','h','root')");
  db.run("INSERT INTO pelanggan (id,email) VALUES ('PLG1','a@x.co')");
  db.run("INSERT INTO pelanggan (id,email) VALUES ('PLG2','b@x.co')");
  db.run("INSERT INTO creator (id,nama) VALUES ('CR1','Penjual Satu')");
  db.run("INSERT INTO produk (id,nama,slug,harga) VALUES ('PR1','Produk','pr1',10000)");
  db.run("INSERT INTO pesanan (id,pelanggan_id,total) VALUES ('ORD1','PLG1',10000)");
  db.run("INSERT INTO pesanan (id,pelanggan_id,total) VALUES ('ORD2','PLG2',5000)");
  db.run("INSERT INTO media (id,nama) VALUES ('MD1','foto.png')");

  // ---- tipe penjualan + anti-duplikasi ----
  coba("INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id,produk_id,pesanan_id) VALUES ('T1','penjualan','PLG1','CR1','PR1','ORD1')");
  ok('thread penjualan + kunci_dedup', q1("SELECT kunci_dedup FROM percakapan WHERE id='T1'") === 'jual:PLG1:CR1');
  harapGagal('pasangan sama ditolak (anti-duplikasi)',
    "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id) VALUES ('T2','penjualan','PLG1','CR1')");
  coba("INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id) VALUES ('T3','penjualan','PLG2','CR1')");
  ok('pasangan lain diizinkan', jml("SELECT COUNT(*) FROM percakapan") === 2);

  // ---- CHECK konteks tipe ----
  harapGagal('penjualan tanpa penjual ditolak', "INSERT INTO percakapan (id,tipe,pelanggan_id) VALUES ('X1','penjualan','PLG1')");
  harapGagal('penjualan ber-petugas CS ditolak',
    "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id,cs_petugas_id) VALUES ('X2','penjualan','PLG1','CR1'," + A1 + ")");
  harapGagal('cs dengan dua pihak ditolak', "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id) VALUES ('X3','cs','PLG1','CR1')");
  harapGagal('cs tanpa pengguna ditolak', "INSERT INTO percakapan (id,tipe) VALUES ('X4','cs')");
  harapGagal('cs ber-konteks pesanan ditolak', "INSERT INTO percakapan (id,tipe,pelanggan_id,pesanan_id) VALUES ('X5','cs','PLG1','ORD1')");

  // ---- FK konteks & petugas ----
  harapGagal('FK pelanggan', "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id) VALUES ('X6','penjualan','NOPE','CR1')");
  harapGagal('FK creator',   "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id) VALUES ('X7','penjualan','PLG1','NOPE')");
  harapGagal('FK produk',    "INSERT INTO percakapan (id,tipe,pelanggan_id,creator_id,produk_id) VALUES ('X8','penjualan','PLG1','CR1','NOPE')");
  harapGagal('FK petugas CS',"INSERT INTO percakapan (id,tipe,pelanggan_id,cs_petugas_id) VALUES ('X9','cs','PLG1',999)");

  // ---- siklus CS: satu thread AKTIF per pengguna ----
  coba("INSERT INTO percakapan (id,tipe,pelanggan_id,cs_petugas_id) VALUES ('TC1','cs','PLG1'," + A1 + ")");
  ok('thread CS aktif + kunci', q1("SELECT kunci_dedup FROM percakapan WHERE id='TC1'") === 'cs:p:PLG1');
  harapGagal('thread CS aktif ganda ditolak', "INSERT INTO percakapan (id,tipe,pelanggan_id) VALUES ('TC2','cs','PLG1')");
  db.run("UPDATE percakapan SET status='closed' WHERE id='TC1'");
  ok('closed -> kunci_dedup NULL', q1("SELECT kunci_dedup FROM percakapan WHERE id='TC1'") === null);
  coba("INSERT INTO percakapan (id,tipe,pelanggan_id) VALUES ('TC3','cs','PLG1')");
  ok('thread CS baru setelah closed diizinkan', jml("SELECT COUNT(*) FROM percakapan WHERE tipe='cs'") === 2);
  harapGagal('buka ulang thread lama saat masih ada aktif ditolak',
    "UPDATE percakapan SET status='open' WHERE id='TC1'");

  // ---- keanggotaan ----
  coba("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG1','T1','pelanggan','PLG1','pembeli')");
  coba("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG2','T1','creator','CR1','penjual')");
  harapGagal('keanggotaan ganda ditolak', "INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG3','T1','pelanggan','PLG1','pembeli')");
  harapGagal('peran tak sah ditolak CHECK', "INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG4','T1','pelanggan','PLG2','root')");
  harapGagal('user_tipe tak sah ditolak CHECK', "INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG5','T1','robot','X','pembeli')");

  // ---- otorisasi pengiriman pesan ----
  coba("INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('M1','T1','pelanggan','PLG1','halo pak','teks')");
  harapGagal('pengirim NON-anggota ditolak FK komposit',
    "INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('M2','T1','pelanggan','PLG2','nyasar','teks')");
  harapGagal('pesan tipe teks tanpa isi ditolak CHECK',
    "INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,tipe) VALUES ('M3','T1','pelanggan','PLG1','teks')");
  coba("INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,tipe) VALUES ('M4','T1','pelanggan','PLG1','gambar')");
  ok('pesan T1 (kirim oleh anggota) = 2', jml("SELECT COUNT(*) FROM pesan WHERE percakapan_id='T1'") === 2);
  coba("INSERT INTO pesan_lampiran (pesan_id,media_id) VALUES ('M4','MD1')");
  harapGagal('lampiran ganda (pesan,media) ditolak', "INSERT INTO pesan_lampiran (pesan_id,media_id) VALUES ('M4','MD1')");

  // ---- CS: penugasan & pengalihan tanpa kehilangan riwayat ----
  coba("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AGC1','TC1','pelanggan','PLG1','pengguna')");
  harapGagal('petugas belum anggota ditolak kirim',
    "INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('MC0','TC1','admin','" + A1 + "','halo','teks')");
  coba("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AGC2','TC1','admin','" + A1 + "','cs')");
  coba("INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('MC1','TC1','admin','" + A1 + "','ada yang bisa dibantu?','teks')");
  db.run("UPDATE percakapan SET cs_petugas_id=" + A2 + " WHERE id='TC1'");
  db.run("UPDATE anggota_percakapan SET keluar_pada=CURRENT_TIMESTAMP WHERE percakapan_id='TC1' AND user_tipe='admin'");
  coba("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AGC3','TC1','admin','" + A2 + "','cs')");
  coba("INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('MC2','TC1','admin','" + A2 + "','Saya lanjutkan, kak.','teks')");
  ok('pengalihan petugas: pesan lama MC1 utuh + MC2 masuk',
     jml("SELECT COUNT(*) FROM pesan WHERE percakapan_id='TC1'") === 2
     && jml("SELECT COUNT(*) FROM pesan WHERE id='MC1'") === 1);
  ok('cs_petugas_id teralihkan & petugas lama ditandai keluar',
     Number(q1("SELECT cs_petugas_id FROM percakapan WHERE id='TC1'")) === Number(A2)
     && jml("SELECT COUNT(*) FROM anggota_percakapan WHERE percakapan_id='TC1' AND keluar_pada IS NOT NULL") === 1);
  harapGagal('petugas tanpa baris keanggotaan ditolak kirim',
    "INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('MC3','TC1','admin','999','gagal','teks')");

  // ---- isolasi konteks transaksi ----
  db.run("UPDATE percakapan SET pesanan_id='ORD2' WHERE id='T3'");
  ok('konteks pesanan terpasang di T3', q1("SELECT pesanan_id FROM percakapan WHERE id='T3'") === 'ORD2');
  harapGagal('satu pesanan hanya jadi konteks SATU percakapan',
    "UPDATE percakapan SET pesanan_id='ORD2' WHERE id='T1'");
  const kunciSebelum = q1("SELECT kunci_dedup FROM percakapan WHERE id='T1'");
  db.run("DELETE FROM pesanan WHERE id='ORD1'");
  ok('pesanan dihapus -> konteks NULL, thread+riwayat selamat, kunci tetap',
     q1("SELECT pesanan_id FROM percakapan WHERE id='T1'") === null
     && jml("SELECT COUNT(*) FROM percakapan WHERE id='T1'") === 1
     && jml("SELECT COUNT(*) FROM pesan WHERE percakapan_id='T1'") === 2
     && q1("SELECT kunci_dedup FROM percakapan WHERE id='T1'") === kunciSebelum);
  db.run("DELETE FROM produk WHERE id='PR1'");
  ok('produk dihapus -> konteks NULL, thread selamat',
     q1("SELECT produk_id FROM percakapan WHERE id='T1'") === null
     && jml("SELECT COUNT(*) FROM percakapan WHERE id='T1'") === 1);

  // ---- cascade pihak & SET NULL petugas ----
  db.run("INSERT INTO anggota_percakapan (id,percakapan_id,user_tipe,user_id,peran) VALUES ('AG3b','T3','pelanggan','PLG2','pembeli')");
  db.run("INSERT INTO pesan (id,percakapan_id,pengirim_tipe,pengirim_id,teks,tipe) VALUES ('M5','T3','pelanggan','PLG2','pesan T3','teks')");
  db.run("DELETE FROM pelanggan WHERE id='PLG2'");
  ok('pelanggan dihapus -> thread+anggota+pesan cascade',
     jml("SELECT COUNT(*) FROM percakapan WHERE id='T3'") === 0
     && jml("SELECT COUNT(*) FROM anggota_percakapan WHERE percakapan_id='T3'") === 0
     && jml("SELECT COUNT(*) FROM pesan WHERE percakapan_id='T3'") === 0);
  db.run("DELETE FROM admin WHERE id=" + A2);
  ok('petugas CS dihapus -> cs_petugas_id NULL, riwayat tetap',
     q1("SELECT cs_petugas_id FROM percakapan WHERE id='TC1'") === null
     && jml("SELECT COUNT(*) FROM pesan WHERE percakapan_id='TC1'") === 2);

  // ---- generated column riwayat tetap berfungsi ----
  db.run("INSERT INTO riwayat_tontonan (id,pelanggan_id,video_id,posisi_detik,durasi_detik) VALUES ('R1','PLG1','VID1',20,30)");
  ok('progres_persen dihitung',
     Math.abs(Number(q1("SELECT progres_persen FROM riwayat_tontonan WHERE id='R1'")) - 66.6667) < 0.01);
  db.run("UPDATE riwayat_tontonan SET posisi_detik=30 WHERE id='R1'");
  ok('selesai=1 saat posisi penuh', Number(q1("SELECT selesai FROM riwayat_tontonan WHERE id='R1'")) === 1);

  // ---- idempotensi: impor ulang seluruh skema ----
  let ulang = 0;
  pernyataan.forEach(s => { try { db.run(s); } catch (e) { ulang++; console.log('  ! ulang: ' + e.message); } });
  ok('impor ulang idempoten', ulang === 0, ulang + ' galat');
  ok('impor ulang tidak menambah tabel',
     jml("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") === 21);

  console.log('\nRINGKASAN: ' + lulus + ' lulus, ' + gagal + ' gagal.');
  process.exitCode = gagal ? 1 : 0;
  try { db.close(); } catch (e) {}
}
main().catch(e => { console.error('FATAL:', e); process.exitCode = 2; });



