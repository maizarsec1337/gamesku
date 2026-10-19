#!/usr/bin/env node
'use strict';
// JEMBATAN DEV SAJA — backend PHP tidak tersedia di PATH Windows ini.
// Menyajikan KONTRAK SAMA PERSIS dengan backend/api/index.php + PengendaliAnime:
//   GET /api/sehat            -> { ok:true, data:{ layanan, waktu, database } }
//   GET /api/anime?...        -> { ok:true, data:{ items, halaman, per, total, totalHalaman, kueri, sumber, diambilPada } }
//   GET /api/anime/{slug}/episode/{no} -> { ok:true, data:{ seri, episode:{ no, judul, tanggal, link, sumberPemutaran, urlPemutaran, embedPemutaran, diperiksaPada } } }
// Sumber data: backend/api/data_anime_lengkap.json (ASLI, tanpa dummy).
// BUKAN bagian deploy — hosting tetap memakai PHP. File ini hanya agar
// `python jalan.py` / Vite dev tetap bisa menampilkan katalog saat PHP belum
// terinstal. Jangan commit sebagai pengganti backend.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
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
    if (req.method !== 'GET') { gagal(res, 'Metode HTTP tidak diizinkan untuk endpoint ini.', 405); return; }
    jalur = (jalur.replace(/^\/api/, '') || '/').replace(/\.php$/, '');
    jalur = '/' + jalur.replace(/^\/+|\/+$/g, '');
    if (jalur === '/' || jalur === '/sehat' || jalur === '') {
      ok(res, { layanan: 'gamesku-store (jembatan-dev)', waktu: new Date().toISOString(), database: 'gagal' });
      return;
    }
    const seg = jalur.split('/').filter(Boolean);
    if (seg[0] !== 'anime') { gagal(res, `Endpoint '${seg[0] || ''}' tidak ditemukan.`, 404); return; }
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
