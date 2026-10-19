#!/usr/bin/env node
'use strict';
// JEMBATAN DEV SAJA — backend PHP tidak tersedia di PATH Windows ini.
// Menyajikan KONTRAK SAMA PERSIS dengan backend/api/index.php + PengendaliAnime:
//   GET /api/sehat            -> { ok:true, data:{ layanan, waktu, database } }
//   GET /api/anime?...        -> { ok:true, data:{ items, halaman, per, total, totalHalaman, kueri, sumber, diambilPada } }
//   GET /api/anime/{slug}/episode/{no} -> { ok:true, data:{ seri, episode:{ no, judul, tanggal, link, sumberPemutaran, urlPemutaran, embedPemutaran, diperiksaPada } } }
//   GET /api/auth/csrf-token   -> { ok:true, data:{ csrf_token } }
//   POST /api/pelanggan/masuk  -> login pembeli + cookie sesi gk_sesi
//   GET  /api/pelanggan/saya   -> { ok:true, data:{ pembeli } | null }
//   POST /api/pelanggan/keluar -> hapus sesi pembeli
//   POST /api/pelanggan        -> daftar pembeli baru
// Sumber data: backend/api/data_anime_lengkap.json (ASLI, tanpa dummy).
// BUKAN bagian deploy — hosting tetap memakai PHP. File ini hanya agar
// `python jalan.py` / Vite dev tetap bisa menampilkan katalog saat PHP belum
// terinstal. Jangan commit sebagai pengganti backend.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import crypto from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = DIR;
const BERKAS = join(ROOT, 'backend', 'api', 'data_anime_lengkap.json');
const PORT = Number(process.env.GAMEKU_JEMBATAN_PORT || 8000);
const PER_BAWAAN = 24;
const PER_MAKS = 48;

let cache = null;
let cacheMtime = 0;
function muat() {
  const mtime = statSync(BERKAS).mtimeMs;
  if (!cache || cacheMtime !== mtime) {
    cache = JSON.parse(readFileSync(BERKAS, 'utf8'));
    if (!cache || !Array.isArray(cache.anime)) throw new Error('Format katalog tidak valid.');
    cacheMtime = mtime;
  }
  return cache;
}
function ringkas(s) {
  const terhitung = Number.isInteger(s.eps_terhitung) ? s.eps_terhitung
    : (Array.isArray(s.eps) ? s.eps.length : 0);
  return {
    idKategori: s.id_kategori ?? null,
    judul: String(s.judul ?? ''),
    slug: String(s.slug ?? ''),
    gambar: String(s.gambar ?? ''),
    jumlahEpisode: terhitung,
    totalEpisode: Number.isInteger(s.total_eps) ? s.total_eps : terhitung,
  };
}
function ringkasEps(e) {
  return {
    no: Number(e.no ?? 0),
    judul: String(e.judul ?? ''),
    tanggal: e.tanggal ? String(e.tanggal) : null,
    link: String(e.link ?? ''),
  };
}
function qInt(v, b, min, maks) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return b;
  return Math.max(min, Math.min(maks, parseInt(v, 10)));
}
function kirim(res, status, obj) {
  const badan = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(badan);
}
const ok = (res, data, pesan = '') => kirim(res, 200, { ok: true, data, pesan });
const gagal = (res, pesan, status = 400) => kirim(res, status, { ok: false, pesan });
const metodeTakDiizinkan = (res) => gagal(res, 'Metode HTTP tidak diizinkan untuk endpoint ini.', 405);

// ===== Toko data pelanggan untuk pengembangan lokal (jembatan-dev) =====
// PHP tidak terpasang di mesin ini, jadi jembatan-dev menyimulasi kontrak
// autentikasi pembeli backend PHP (tabel pelanggan + cookie sesi) dengan
// berkas data lokal + memori. BUKAN untuk produksi — produksi tetap pakai
// backend/api/index.php + MySQL.
const BERKAS_PELANGGAN = join(ROOT, 'backend', 'api', 'data_pelanggan_dev.json');
let daftarPelanggan = [];
let indeksEmail = new Map();
function muatPelanggan() {
  try {
    const isi = JSON.parse(readFileSync(BERKAS_PELANGGAN, 'utf8'));
    daftarPelanggan = Array.isArray(isi.pelanggan) ? isi.pelanggan : [];
    indeksEmail = new Map(daftarPelanggan.filter((p) => p && p.email).map((p) => [String(p.email).toLowerCase(), p]));
  } catch {
    daftarPelanggan = [];
    indeksEmail = new Map();
  }
}
function cariPelanggan(email) { return indeksEmail.get(String(email ?? '').toLowerCase()) ?? null; }
muatPelanggan();

// ===== Sesi & CSRF (memori, development) =====
const SESSION_IDLE = 30 * 60 * 1000; // 30 menit, sama konfigurasi sesi PHP
const TOKEN_CSRF_IDLE = 10 * 60 * 1000; // 10 menit
const sesiMap = new Map(); // idSesi -> { pembeli, expiresAt }
const daftarTokenCsrf = new Map(); // token -> expiresAt
const batasMasukPerIp = new Map(); // ip -> { hitung, resetAt }

function buatSesi(pembeli) {
  const id = crypto.randomBytes(24).toString('hex');
  sesiMap.set(id, { pembeli, expiresAt: Date.now() + SESSION_IDLE });
  return id;
}
function ambilSesi(idSesi) {
  if (!idSesi) return null;
  const s = sesiMap.get(idSesi);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sesiMap.delete(idSesi); return null; }
  return s.pembeli;
}
function hapusSesi(idSesi) { if (idSesi) sesiMap.delete(idSesi); }
function buatTokenCsrf() {
  const token = crypto.randomBytes(24).toString('hex');
  daftarTokenCsrf.set(token, Date.now() + TOKEN_CSRF_IDLE);
  return token;
}
function validasiTokenCsrf(token) {
  if (!token) return false;
  const exp = daftarTokenCsrf.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { daftarTokenCsrf.delete(token); return false; }
  return true;
}
function cookieSesiHeader(idSesi) { return `gk_sesi=${idSesi}; Path=/; HttpOnly; SameSite=Lax`; }
function cookieHapusHeader() { return 'gk_sesi=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'; }
function bacaIdSesiDariCookie(req) {
  const c = req.headers.cookie ?? '';
  const m = c.match(/(?:^|;)\s*gk_sesi=([^;]*)/);
  return m ? m[1] : null;
}
function ambilSesiDariCookie(req) { return ambilSesi(bacaIdSesiDariCookie(req)); }

// Rate limit login per IP (mirip AuthRateLimiter PHP; di sini disimpan di memori).
function cekBatasMasuk(ip) {
  const now = Date.now();
  let ent = batasMasukPerIp.get(ip);
  if (!ent || now > ent.resetAt) {
    ent = { hitung: 1, resetAt: now + 60000 };
    batasMasukPerIp.set(ip, ent);
    return { limited: false };
  }
  ent.hitung++;
  return { limited: ent.hitung > 10, retry_after: Math.ceil((ent.resetAt - now) / 1000) || 1 };
}

function ipKlien(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim() || 'unknown';
  return req.socket.remoteAddress || 'unknown';
}

// Verifikasi sandi dengan hash SHA-256 (timing-safe, tanpa membandingkan teks asli).
function cocokkanSandi(sandi, hash) {
  if (!sandi || typeof hash !== 'string') return false;
  const komputasi = crypto.createHash('sha256').update(sandi).digest();
  const simpan = Buffer.from(hash, 'hex');
  if (komputasi.length !== simpan.length) return false;
  return crypto.timingSafeEqual(komputasi, simpan);
}

function bacaBadanJson(req) {
  return new Promise((resolve) => {
    const potongan = [];
    req.on('data', (c) => potongan.push(c));
    req.on('end', () => {
      const teks = Buffer.concat(potongan).toString('utf8');
      try { resolve(teks === '' ? {} : JSON.parse(teks)); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// ===== Handler autentikasi pembeli (mirip PengendaliPelanggan + Auth PHP) =====
async function handleMasukPembeli(req, res) {
  const token = req.headers['x-csrf-token'] ?? '';
  if (!validasiTokenCsrf(token)) {
    gagal(res, 'Token keamanan tidak valid.', 403);
    return;
  }
  const badan = await bacaBadanJson(req);
  if (badan === null) {
    gagal(res, 'Badan permintaan tidak dapat dibaca.', 400);
    return;
  }
  const email = String(badan.email ?? '').trim().toLowerCase();
  const sandi = String(badan.sandi ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    gagal(res, 'Email tidak valid.', 400);
    return;
  }
  if (sandi === '') {
    gagal(res, 'Email atau kata sandi salah.', 401);
    return;
  }

  const batas = cekBatasMasuk(ipKlien(req));
  if (batas.limited) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(batas.retry_after ?? 60) });
    res.end(JSON.stringify({ ok: false, pesan: 'Layanan sibuk. Coba lagi nanti.' }));
    return;
  }

  // Pesan samar: tidak membedakan email tidak terdaftar dari sandi salah.
  const pelanggan = cariPelanggan(email);
  if (!pelanggan || !cocokkanSandi(sandi, pelanggan.sandi_hash)) {
    gagal(res, 'Email atau kata sandi salah.', 401);
    return;
  }
  if (pelanggan.status !== 'Aktif') {
    gagal(res, 'Akun tidak aktif.', 401);
    return;
  }

  const idSesi = buatSesi({
    id: pelanggan.id,
    nama: pelanggan.nama,
    username: pelanggan.username,
    email: pelanggan.email,
  });
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': cookieSesiHeader(idSesi),
  });
  res.end(JSON.stringify({
    ok: true,
    data: { id: pelanggan.id, nama: pelanggan.nama, username: pelanggan.username, email: pelanggan.email },
    pesan: 'Berhasil masuk.',
  }));
}

async function handleKeluarPembeli(req, res) {
  const token = req.headers['x-csrf-token'] ?? '';
  if (!validasiTokenCsrf(token)) {
    gagal(res, 'Token keamanan tidak valid.', 403);
    return;
  }
  hapusSesi(bacaIdSesiDariCookie(req));
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': cookieHapusHeader(),
  });
  res.end(JSON.stringify({ ok: true, data: null, pesan: 'Berhasil keluar.' }));
}

async function handleDaftarPembeli(req, res) {
  const token = req.headers['x-csrf-token'] ?? '';
  if (!validasiTokenCsrf(token)) {
    gagal(res, 'Token keamanan tidak valid.', 403);
    return;
  }
  const badan = await bacaBadanJson(req);
  if (badan === null) {
    gagal(res, 'Badan permintaan tidak dapat dibaca.', 400);
    return;
  }
  const email = String(badan.email ?? '').trim().toLowerCase();
  const nama = String(badan.nama ?? '').trim();
  const sandi = String(badan.sandi ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    gagal(res, 'Email pelanggan tidak valid.', 400);
    return;
  }
  if (nama === '') {
    gagal(res, 'Nama wajib diisi.', 400);
    return;
  }
  if (sandi.length < 8) {
    gagal(res, 'Sandi minimal 8 karakter.', 400);
    return;
  }
  if (cariPelanggan(email)) {
    gagal(res, 'Email sudah terdaftar.', 409);
    return;
  }
  const id = 'pel-' + crypto.randomBytes(6).toString('hex');
  const baru = {
    id,
    nama,
    username: nama.toLowerCase().replace(/\s+/g, '_').slice(0, 60) || 'pelanggan',
    email,
    sandi_hash: crypto.createHash('sha256').update(sandi).digest('hex'),
    status: 'Aktif',
    bergabung: new Date().toISOString(),
  };
  daftarPelanggan.push(baru);
  indeksEmail.set(email, baru);
  res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, data: { id, nama, email }, pesan: 'Pendaftaran berhasil.' }));
}

// ===== Resolusi sumber pemutaran (paritas PengendaliAnime::resolusiPemutaran) =====
// Rantai diverifikasi live 2026-10-17: halaman episode -> iframe partner atau
// hash as_load_player -> halaman embed -> URL .mp4/.m3u8 statis. Gagal = jujur
// 'belum-tersedia' (tanpa URL karangan). Cache per episode, TTL 6 jam.
const TTL_PEMUTARAN = 6 * 60 * 60 * 1000;
const cachePemutaran = new Map();
const UA_PEMUTARAN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function urlAman(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return false;
    const h = x.hostname.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false; // literal IP
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h)) return false;
    if (h.endsWith('.local') || h.endsWith('.internal')) return false;
    return true;
  } catch { return false; }
}

async function httpAmbil(url, referer) {
  if (!urlAman(url)) return null;
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': UA_PEMUTARAN, ...(referer ? { Referer: referer } : {}) },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function httpPos(url, badan, referer) {
  if (!urlAman(url)) return null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': UA_PEMUTARAN,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: referer,
      },
      body: badan,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function ekstrakIframePemutar(html) {
  for (const cakupan of ['megavid', 'video-content']) {
    const pos = html.indexOf(cakupan);
    if (pos === -1) continue;
    const m = html.slice(pos, pos + 4000).match(/<iframe[^>]*?src=["'](https:\/\/[^"']+)["']/i);
    if (m && urlAman(m[1])) return m[1].trim();
  }
  const m = html.match(/<iframe[^>]*?src=["'](https:\/\/[^"']+)["']/i);
  return m && urlAman(m[1]) ? m[1].trim() : null;
}

function ekstrakHashMirror(html) {
  const m = html.match(/<option\s+value=["']([A-Za-z0-9+/=]{40,})["']/);
  if (!m) return null;
  let t;
  try { t = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return null; }
  const h = t.match(/data-video=["']([^"']+)["']/);
  return h ? h[1] : null;
}

async function mutasiAjaxPemutar(hash, linkHalaman) {
  let asal;
  try { asal = new URL(linkHalaman); } catch { return null; }
  const url = asal.origin + '/wp-admin/admin-ajax.php';
  const isi = await httpPos(url, 'action=as_load_player&hash=' + encodeURIComponent(hash), linkHalaman);
  if (!isi) return null;
  const m = isi.match(/<iframe[^>]*?src=["'](https:\/\/[^"']+)["']/i);
  return m && urlAman(m[1]) ? m[1].trim() : null;
}

function ekstrakUrlMedia(html) {
  let m = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
  if (m && urlAman(m[0])) return { tipe: 'mp4', url: m[0].replace(/\\+$/, '') };
  m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
  if (m && urlAman(m[0])) return { tipe: 'hls', url: m[0].replace(/\\+$/, '') };
  return null;
}

async function resolusiPemutaran(slug, no, link) {
  const kosong = {
    sumberPemutaran: 'belum-tersedia',
    urlPemutaran: null,
    embedPemutaran: null,
    diperiksaPada: new Date().toISOString(),
  };
  if (!link || !/^https:\/\//i.test(link)) return kosong;
  const kunci = slug + '#' + no;
  const c = cachePemutaran.get(kunci);
  if (c && Date.now() - c.ts < TTL_PEMUTARAN) return c.hasil;
  let hasil = kosong;
  try {
    const halaman = await httpAmbil(link, 'https://otakudesu.com.mx/');
    if (halaman) {
      let embed = ekstrakIframePemutar(halaman);
      if (!embed) {
        const hash = ekstrakHashMirror(halaman);
        if (hash) embed = await mutasiAjaxPemutar(hash, link);
      }
      if (embed) {
        const isi = await httpAmbil(embed, link);
        if (isi) {
          const media = ekstrakUrlMedia(isi);
          if (media) {
            hasil = {
              sumberPemutaran: media.tipe,
              urlPemutaran: media.url,
              embedPemutaran: embed,
              diperiksaPada: new Date().toISOString(),
            };
          }
        }
      }
    }
  } catch { /* kegagalan resolver = belum-tersedia (jujur) */ }
  cachePemutaran.set(kunci, { ts: Date.now(), hasil });
  return hasil;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let jalur = decodeURIComponent(url.pathname || '/');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    jalur = (jalur.replace(/^\/api/, '') || '/').replace(/\.php$/, '');
    jalur = '/' + jalur.replace(/^\/+|\/+$/g, '');
    if (jalur === '/' || jalur === '/sehat' || jalur === '') {
      if (req.method !== 'GET') { gagal(res, 'Metode HTTP tidak diizinkan untuk endpoint ini.', 405); return; }
      ok(res, { layanan: 'gamesku-store (jembatan-dev)', waktu: new Date().toISOString(), database: 'gagal' });
      return;
    }
    const seg = jalur.split('/').filter(Boolean);
    const sumber = seg[0] || '';

    // ===== Kontrak auth pembeli (sama dengan backend PHP: api/index.php + PengendaliPelanggan) =====
    //   GET    /api/auth/csrf-token   ambil token CSRF
    //   POST   /api/pelanggan/masuk   login pembeli (email + sandi) + cookie sesi
    //   GET    /api/pelanggan/saya    cek sesi pembeli saat ini
    //   POST   /api/pelanggan/keluar  hapus sesi pembeli
    //   POST   /api/pelanggan         daftar pembeli baru
    if (sumber === 'auth') {
      const aksi = seg[1] ?? null;
      if (aksi === 'csrf-token') {
        if (req.method !== 'GET') { metodeTakDiizinkan(res); return; }
        ok(res, { csrf_token: buatTokenCsrf() }, 'Token CSRF siap.');
        return;
      }
      gagal(res, aksi ? `Endpoint '/auth/${aksi}' tidak dikenali.` : "Endpoint 'auth' tidak ditemukan.", 404);
      return;
    }

    if (sumber === 'pelanggan') {
      const aksi = seg[1] ?? null;
      if (aksi === 'masuk') {
        if (req.method !== 'POST') { metodeTakDiizinkan(res); return; }
        await handleMasukPembeli(req, res);
        return;
      }
      if (aksi === 'keluar') {
        if (req.method !== 'POST') { metodeTakDiizinkan(res); return; }
        await handleKeluarPembeli(req, res);
        return;
      }
      if (aksi === 'saya') {
        if (req.method !== 'GET') { metodeTakDiizinkan(res); return; }
        const sesi = ambilSesiDariCookie(req);
        ok(res, sesi ? { pembeli: sesi } : null);
        return;
      }
      if (!aksi) {
        if (req.method !== 'POST') { metodeTakDiizinkan(res); return; }
        await handleDaftarPembeli(req, res);
        return;
      }
      gagal(res, `Endpoint '/pelanggan/${aksi}' tidak dikenali.`, 404);
      return;
    }

    // ===== Anime (tidak berubah) =====
    if (sumber !== 'anime') { gagal(res, `Endpoint '${sumber}' tidak ditemukan.`, 404); return; }
    const data = muat();
    const slug = seg[1] ?? null;
    const sub = seg[2] ?? null;
    if (slug === null) {
      const q = String(url.searchParams.get('q') || '').toLowerCase();
      let semua = data.anime;
      if (q !== '') semua = semua.filter((s) => String(s.judul || '') .toLowerCase().includes(q) || String(s.slug || '').toLowerCase().includes(q));
      const total = semua.length;
      const per = qInt(url.searchParams.get('per'), PER_BAWAAN, 1, PER_MAKS);
      const totalHalaman = total > 0 ? Math.ceil(total / per) : 1;
      let halaman = qInt(url.searchParams.get('halaman'), 1, 1, 1000000);
      if (halaman > totalHalaman) halaman = totalHalaman;
      const potong = semua.slice((halaman - 1) * per, (halaman - 1) * per + per);
      ok(res, {
        items: potong.map(ringkas), halaman, per, total, totalHalaman, kueri: q,
        sumber: data.sumber ?? null, diambilPada: data.diambil_pada ?? null,
      });
      return;
    }
    const peta = new Map(data.anime.filter((s) => typeof s.slug === 'string').map((s) => [s.slug, s]));
    const seri = peta.get(slug) ?? null;
    if (sub === 'episode') {
      const noMentah = seg[3] ?? url.searchParams.get('no') ?? '';
      if (!/^\d+$/.test(String(noMentah)) || Number(noMentah) < 1) { gagal(res, 'Nomor episode tidak valid.', 400); return; }
      if (!seri) { gagal(res, 'Seri anime tidak ditemukan.', 404); return; }
      const ketemu = (seri.eps || []).find((e) => Number(e.no) === Number(noMentah)) ?? null;
      if (!ketemu) { gagal(res, 'Episode tidak ditemukan.', 404); return; }
      const eps = ringkasEps(ketemu);
      const pemutaran = await resolusiPemutaran(
        String(seri.slug || ''), Number(noMentah), String(ketemu.link || ''),
      );
      eps.sumberPemutaran = pemutaran.sumberPemutaran;
      eps.urlPemutaran = pemutaran.urlPemutaran;
      eps.embedPemutaran = pemutaran.embedPemutaran;
      eps.diperiksaPada = pemutaran.diperiksaPada;
      ok(res, { seri: { judul: String(seri.judul || ''), slug: String(seri.slug || '') }, episode: eps });
      return;
    }
    if (!seri) { gagal(res, 'Seri anime tidak ditemukan.', 404); return; }
    const eps = (seri.eps || []).map(ringkasEps).sort((a, b) => a.no - b.no);
    ok(res, { seri: ringkas(seri), episode: eps });
  } catch (e) {
    gagal(res, 'Katalog anime tidak dapat dimuat.', 500);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[jembatan-dev] http://localhost:${PORT} <- ${BERKAS}`));
