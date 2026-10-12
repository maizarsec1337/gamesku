// Uji visual browser RAK VIN — Playwright + Chrome sistem (tanpa unduh browser).
// Jalankan dari folder frontend: npm run uji-visual -- [url]
// Memeriksa 320/375/390/430/desktop: shell 430px, overflow-x, bottom-nav,
// hero slider, console error, reduced-motion.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const URL = process.argv[2] || 'http://localhost:4173'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const kasus = [
  { nama: '320px', lebar: 320, tinggi: 700 },
  { nama: '375px', lebar: 375, tinggi: 780 },
  { nama: '390px', lebar: 390, tinggi: 844 },
  { nama: '430px', lebar: 430, tinggi: 900 },
  { nama: 'desktop', lebar: 1280, tinggi: 900 },
]

const skrip = `
const { chromium } = require('playwright');
(async () => {
  const hasil = [];
  const browser = await chromium.launch({ executablePath: ${JSON.stringify(CHROME)}, args: ['--no-sandbox'] });
  for (const k of ${JSON.stringify(kasus)}) {
    const ctx = await browser.newContext({ viewport: { width: k.lebar, height: k.tinggi } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(${JSON.stringify(URL)}, { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => errors.push('goto: ' + String(e).slice(0, 120)));
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => {
      const root = document.getElementById('root');
      const r = root ? root.getBoundingClientRect() : null;
      const nav = document.querySelector('.navigasi-bawah');
      const n = nav ? nav.getBoundingClientRect() : null;
      const hero = document.querySelector('.hero-slider');
      const kepala = document.querySelector('.kepala');
      const gayaKepala = kepala ? getComputedStyle(kepala) : null;
      const logo = document.querySelector('.logo-teks');
      const gayaLogo = logo ? getComputedStyle(logo) : null;
      const menuAktif = document.querySelector('.menu-bawah-aktif .menu-bawah-ikon');
      const gayaAktif = menuAktif ? getComputedStyle(menuAktif) : null;
      const tombol = document.querySelector('.tombol-utama, .cta, .tombol-kuning');
      const tb = tombol ? tombol.getBoundingClientRect() : null;
      const kosong = document.querySelector('.keadaan-kosong');
      return {
        lebarRoot: r ? Math.round(r.width) : -1,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        navTertutup: n ? Math.round(n.bottom - (window.innerHeight)) : null,
        navLebar: n ? Math.round(n.width) : -1,
        adaHero: !!hero,
        geserHero: hero ? hero.scrollWidth > hero.clientWidth + 4 : false,
        kepalaBiru: gayaKepala ? /rgb\\(37, 99, 235\\)|linear-gradient/.test(gayaKepala.background) : false,
        logoPutih: gayaLogo ? gayaLogo.color === 'rgb(255, 255, 255)' : false,
        indikatorAktif: gayaAktif ? gayaAktif.backgroundColor : '',
        ctaTerlihat: tb ? (tb.bottom <= window.innerHeight + 1) : false,
        adaEmptyState: !!kosong,
        judul: document.title,
      };
    });
    // Interaksi: klik menu Store pada bottom nav, pastikan route berubah.
    let klikNav = false;
    try {
      await page.click('.navigasi-bawah a[href="/store"]', { timeout: 4000 });
      await page.waitForURL('**/store', { timeout: 5000 }).catch(() => {});
      klikNav = page.url().includes('/store');
    } catch { klikNav = false; }
    const rute = ['/store', '/kategori', '/promo', '/keranjang', '/profil'];
    const gagalRute = [];
    for (const rt of rute) {
      const res = await page.goto(${JSON.stringify(URL)} + rt, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
      if (!res || res.status() >= 400) gagalRute.push(rt);
    }
    hasil.push({ viewport: k.nama, klikNav, ...d, errors: errors.slice(0, 4), gagalRute });
    await ctx.close();
  }
  // prefers-reduced-motion: animasi harus dinetralkan.
  const ctxRM = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const pageRM = await ctxRM.newPage();
  await pageRM.goto(${JSON.stringify(URL)}, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await pageRM.waitForTimeout(800);
  const rm = await pageRM.evaluate(() => {
    const el = document.querySelector('.reveal') || document.querySelector('.tombol');
    const cs = el ? getComputedStyle(el) : null;
    return {
      cocok: matchMedia('(prefers-reduced-motion: reduce)').matches,
      durasiTransisi: cs ? cs.transitionDuration : '',
      heroSnap: (() => { const h = document.querySelector('.hero-slider'); return h ? getComputedStyle(h).scrollSnapType : ''; })(),
    };
  });
  hasil.push({ viewport: 'reduced-motion', ...rm });
  await ctxRM.close();
  await browser.close();
  console.log(JSON.stringify(hasil, null, 2));
})();
`
writeFileSync('.uji-visual-tmp.cjs', skrip)
const p = spawn('node', ['.uji-visual-tmp.cjs'], { stdio: 'inherit', shell: false })
p.on('exit', (code) => process.exit(code ?? 0))
