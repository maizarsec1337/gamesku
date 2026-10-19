// Uji rantai resolver Streamku (audit end-to-end, dihapus setelah pakai):
// halaman episode otakudesu -> hash as_load_player -> iframe animehi -> sumber video.
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function ambil(url, opt = {}) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, ...(opt.headers || {}) },
    method: opt.method || 'GET',
    body: opt.body,
  });
  const teks = await r.text().catch(() => '');
  return { status: r.status, teks, header: r.headers };
}

const HASIL = [];

async function ujiEpisode(urlHalaman) {
  const catatan = { halaman: urlHalaman, iframeLangsung: null, hash: null, iframeAjax: null, sumberVideo: null, galat: null };
  try {
    const ep = await ambil(urlHalaman, { headers: { Referer: 'https://otakudesu.com.mx/' } });
    if (ep.status !== 200) { catatan.galat = 'halaman episode HTTP ' + ep.status; return catatan; }

    // 1) iframe langsung di HTML
    const mIframe = ep.teks.match(/<iframe[^>]*?src=["']([^"']+)["']/i);
    if (mIframe) catatan.iframeLangsung = mIframe[1];

    // 2) mirror select -> hash as_load_player
    if (!mIframe) {
      const mOpt = ep.teks.match(/<option value="([A-Za-z0-9+/=]{40,})"/);
      if (mOpt) {
        const terdecode = Buffer.from(mOpt[1], 'base64').toString('utf8');
        const mHash = terdecode.match(/data-video="([^"]+)"/);
        if (mHash) catatan.hash = mHash[1];
      }
    }

    if (catatan.hash) {
      const ajax = await ambil('https://otakudesu.com.mx/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: urlHalaman },
        body: 'action=as_load_player&hash=' + encodeURIComponent(catatan.hash),
      });
      const mEmb = ajax.teks.match(/<iframe[^>]*?src=["']([^"']+)["']/i);
      if (mEmb) catatan.iframeAjax = mEmb[1];
      else catatan.galat = 'ajax tanpa iframe: ' + ajax.teks.slice(0, 100);
    }

    const embed = catatan.iframeLangsung || catatan.iframeAjax;
    if (embed) {
      const em = await ambil(embed, { headers: { Referer: 'https://otakudesu.com.mx/' } });
      // pola 1: source statis mp4/m3u8
      const mMp4 = em.teks.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
      const m3u8 = em.teks.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (mMp4) catatan.sumberVideo = { tipe: 'mp4', url: mMp4[0] };
      else if (m3u8) catatan.sumberVideo = { tipe: 'hls', url: m3u8[0] };
      else if (/sources\s*:\s*\[\s*\]/.test(em.teks)) catatan.galat = 'embed JWPlayer sources KOSONG (runtime tidak terpecahkan)';
      else catatan.galat = 'embed tanpa sumber video dikenal';
    } else if (!catatan.galat) {
      catatan.galat = 'tidak ada iframe maupun hash mirror';
    }
  } catch (e) {
    catatan.galat = String(e && e.message || e);
  }
  HASIL.push(catatan);
  return catatan;
}

const DAFTAR = process.argv.slice(2);
for (const u of DAFTAR) await ujiEpisode(u);
if (DAFTAR.length === 0) {
  await ujiEpisode('https://otakudesu.com.mx/oshi-no-ko-3rd-season-episode-1-sub-indo/');
  await ujiEpisode('https://otakudesu.com.mx/oshi-no-ko-3rd-season-episode-2-sub-indo/');
  await ujiEpisode('https://otakudesu.com.mx/oshi-no-ko-3rd-season-episode-9-sub-indo/');
  await ujiEpisode('https://otakudesu.com.mx/class-de-2-banme-ni-kawaii-onnanoko-to-tomodachi-ni-natta-episode-1-sub-indo/');
}

writeFileSync('audit_rantai.json', JSON.stringify(HASIL, null, 2));
console.log(JSON.stringify(HASIL, null, 2));
