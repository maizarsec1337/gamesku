# -*- coding: utf-8 -*-
# Pengumpul data lengkap otakudesu.com.mx: judul + gambar + daftar episode semua anime
# Sumber: REST API publik (tanpa auth) + halaman poster per seri
import json, re, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://otakudesu.com.mx"
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
      "Accept": "application/json,text/html,*/*"}
W = "/data/data/com.termux/files/home/otaku_recon"

def get_json(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace")), dict(r.headers)
        except Exception:
            if i == tries - 1:
                return None, {}
            time.sleep(1)

def get_all_pages(path, per=100, fields=""):
    out = []
    page = 1
    while True:
        f = ("&_fields=" + fields) if fields else ""
        data, hdr = get_json(f"{BASE}{path}?per_page={per}&page={page}{f}")
        if not isinstance(data, list) or not data:
            break
        out.extend(data)
        total_pages = hdr.get("X-WP-TotalPages")
        if total_pages and int(total_pages) <= page:
            break
        page += 1
        if page > 200:
            break
    return out

def fetch_poster(slug):
    url = f"{BASE}/{slug}/"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as r:
            h = r.read().decode("utf-8", "replace")
        m = re.search(r'<meta property="og:image" content="([^"]+)"', h)
        if m:
            return m.group(1)
        imgs = re.findall(r'<img[^>]+src="(https?://i\d?\.wp\.com/otakudesu\.com\.mx[^"]*(?:uploads)[^"]*)"', h)
        for im in imgs:
            if "logo" not in im.lower():
                return im
        return None
    except Exception:
        return None

print("Langkah 1/3: ambil daftar kategori (seri anime)...")
cats = get_all_pages("/wp-json/wp/v2/categories", fields="id,name,slug,count,link")
print("  kategori:", len(cats))

print("Langkah 2/3: ambil SEMUA post episode...")
posts = get_all_pages("/wp-json/wp/v2/posts", fields="id,date,link,title,categories,slug")
print("  episode:", len(posts))

ep_by_cat = {}
for p in posts:
    for c in p.get("categories", []):
        ep_by_cat.setdefault(c, []).append(p)

print("Langkah 3/3: ambil poster per seri...")
slugs = [c["slug"] for c in cats]
with ThreadPoolExecutor(max_workers=6) as ex:
    posters = dict(zip(slugs, ex.map(fetch_poster, slugs)))

anime_out = []
total_eps = 0
for c in cats:
    eps = ep_by_cat.get(c["id"], [])
    eps_sorted = sorted(eps, key=lambda x: x.get("date", ""), reverse=True)
    eplist = []
    for e in eps_sorted:
        m = re.search(r"[Ee]pisode\s*(\d+)", e["title"]["rendered"])
        eplist.append({
            "no": int(m.group(1)) if m else None,
            "judul": re.sub(r"\s+", " ", e["title"]["rendered"]).strip(),
            "tanggal": e["date"],
            "link": e["link"],
        })
    total_eps += len(eplist)
    anime_out.append({
        "id_kategori": c["id"],
        "judul": c["name"],
        "slug": c["slug"],
        "gambar": posters.get(c["slug"]),
        "total_eps": c.get("count", len(eplist)),
        "eps_terhitung": len(eplist),
        "eps": eplist,
    })

result = {
    "sumber": "https://otakudesu.com.mx (WP REST publik + halaman seri)",
    "diambil_pada": time.strftime("%Y-%m-%d %H:%M:%S"),
    "total_seri": len(anime_out),
    "total_episode_terhitung": total_eps,
    "anime": anime_out,
}

path = W + "/data_anime_lengkap.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print("SELESAI:", len(anime_out), "seri |", total_eps, "episode |", path)

