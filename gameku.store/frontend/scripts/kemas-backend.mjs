// Mengemas backend PHP ke folder dist terpadu (dijalankan setelah vite build).

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skripDir = dirname(fileURLToPath(import.meta.url))
const akar = join(skripDir, '..', '..')
const backend = join(akar, 'backend')
const dist = join(akar, 'dist')

function gagal(pesan) {
  console.error(`[kemas-backend] GALAT: ${pesan}`)
  process.exit(1)
}

// Prasyarat: vite build harus sudah mengisi dist/.
if (!existsSync(join(dist, 'index.html'))) {
  gagal('dist/index.html tidak ditemukan. Jalankan `vite build` dulu.')
}

// Salin backend (whitelist).
// Catatan: folder api/ juga memuat data & artefak internal Streamku
// (data_anime_lengkap.json + berkas riset .md/.html/.js/.py/.csv) yang TIDAK
// boleh ikut terekspos sebagai aset publik. Karena itu hanya api/index.php
// yang disalin; katalog anime dipindahkan ke lokasi ter-proteksi src/data/
// (diblokir akses HTTP oleh .htaccess deployment).
const salinan = [
  ['src', 'src'],
]
for (const [dari, ke] of salinan) {
  const sumber = join(backend, dari)
  if (!existsSync(sumber)) gagal(`folder backend/${dari}/ tidak ditemukan.`)
  cpSync(sumber, join(dist, ke), {
    recursive: true,
    filter: (jalur) => !/\.bak$|\.log$/i.test(jalur),
  })
}

// API: salin HANYA front-controller index.php (bukan dump JSON/artefak riset).
mkdirSync(join(dist, 'api'), { recursive: true })
const apiIndex = join(backend, 'api', 'index.php')
if (!existsSync(apiIndex)) gagal('backend/api/index.php tidak ditemukan.')
cpSync(apiIndex, join(dist, 'api', 'index.php'))

// Katalog anime -> lokasi ter-proteksi dist/src/data/ (sesuai KatalogAnime::jalurBerkas()).
const katalogSumber = join(backend, 'api', 'data_anime_lengkap.json')
if (existsSync(katalogSumber)) {
  mkdirSync(join(dist, 'src', 'data'), { recursive: true })
  cpSync(katalogSumber, join(dist, 'src', 'data', 'data_anime_lengkap.json'))
}


// Satu config: backend/config/config.php -> dist/config/config.php.
const configSumber = join(backend, 'config', 'config.php')
if (!existsSync(configSumber)) {
  gagal('backend/config/config.php tidak ditemukan (config utama hilang?).')
}
mkdirSync(join(dist, 'config'), { recursive: true })
cpSync(configSumber, join(dist, 'config', 'config.php'))

// Database: skema + installer.
mkdirSync(join(dist, 'database'), { recursive: true })
for (const berkas of ['skema.sql', 'instal.php']) {
  const sumber = join(backend, 'database', berkas)
  if (existsSync(sumber)) cpSync(sumber, join(dist, 'database', berkas))
}

// Folder uploads kosong (siap tulis di hosting).
mkdirSync(join(dist, 'uploads'), { recursive: true })
const gitkeep = join(backend, 'uploads', '.gitkeep')
if (existsSync(gitkeep)) cpSync(gitkeep, join(dist, 'uploads', '.gitkeep'))

// dist/.htaccess gabungan: API + SPA + proteksi.
writeFileSync(
  join(dist, '.htaccess'),
  `# ---------------------------------------------------------------------
# gameku.store — paket deployment TERPADU (frontend build + backend PHP).
# Dibuat otomatis oleh frontend/scripts/kemas-backend.mjs — jangan edit
# manual, ubah skripnya lalu jalankan ulang \`npm run build\`.
# ---------------------------------------------------------------------

Options -Indexes

<IfModule mod_rewrite.c>
    RewriteEngine On

    # 1) Blokir akses browser ke area sensitif (config, kode, DB, log).
    RewriteRule ^(config|src|database|logs)(/|$) - [F,L]
    RewriteRule \\.(sql|bak|log|env)$ - [F,L]

    # 2) Endpoint API -> front-controller (kecuali berkas nyata).
    RewriteCond %{REQUEST_URI} ^/api/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ api/index.php [QSA,L]

    # 3) Berkas/folder nyata (aset Vite, favicon, uploads) -> layani langsung.
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # 4) Rute React selain itu -> index.html (SPA fallback).
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteRule ^ index.html [L]
</IfModule>

# Pertahanan berlapis bila mod_rewrite mati di hosting.
<FilesMatch "^(config\\.php|contoh\\.config\\.php|instal\\.php|skema.*\\.sql)$">
    Require all denied
</FilesMatch>
`,
)

// Matikan eksekusi skrip di folder unggahan.
writeFileSync(
  join(dist, 'uploads', '.htaccess'),
  `# Unggahan hanya boleh diunduh, tidak boleh dieksekusi sebagai skrip.
<FilesMatch "\\.(php|phtml|phar|cgi|pl)$">
    Require all denied
</FilesMatch>
RemoveHandler .php .phtml
RemoveType .php .phtml
`,
)

// Verifikasi berkas wajib ada.
const wajib = [
  'index.html',
  'assets',
  'api/index.php',
  'src/bootstrap.php',
  'src/Database.php',
  'config/config.php',
  'database/skema.sql',
  'uploads',
  '.htaccess',
]
for (const relatif of wajib) {
  if (!existsSync(join(dist, relatif))) gagal(`hasil kemas kurang: dist/${relatif}`)
}

// Pastikan katalog anime terpasang di lokasi ter-proteksi (bukan di api/ publik).
if (existsSync(join(backend, 'api', 'data_anime_lengkap.json'))
    && !existsSync(join(dist, 'src', 'data', 'data_anime_lengkap.json'))) {
  gagal('katalog anime tidak terpasang di dist/src/data/ (lokasi ter-proteksi).')
}

// Jaga agar tidak ada dump JSON/artefak riset yang bocor ke api/ publik.
const apiPublik = join(dist, 'api')
if (existsSync(apiPublik)) {
  const bocor = readdirSync(apiPublik).filter((n) => n !== 'index.php')
  if (bocor.length > 0) {
    gagal(`dist/api/ memuat berkas non-index yang seharusnya tidak diekspos: ${bocor.join(', ')}`)
  }
}


// Ringkasan isi dist/.
function daftar(dir, awalan = '') {
  let keluar = []
  for (const nama of readdirSync(dir).sort()) {
    const penuh = join(dir, nama)
    const rel = awalan + nama
    if (statSync(penuh).isDirectory()) keluar = keluar.concat(daftar(penuh, `${rel}/`))
    else keluar.push(`${rel} (${statSync(penuh).size} B)`)
  }
  return keluar
}
console.log('[kemas-backend] dist/ terpadu siap:')
for (const baris of daftar(dist)) console.log(`  ${baris}`)
