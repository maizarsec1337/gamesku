# DEPLOYMENT CONFIGURATION — Vercel + Backend PHP

> **Domain frontend:** Belum ditentukan (Vercel) — gunakan `.env` untuk konfigurasi
> **Domain backend:** Server PHP (tidak Vercel) — URL lain di eksternal
> **Database:** Belum ditentukan — konfigurasi akan disesuaikan nanti
> **Cloudflare:** Belum dikonfigurasi — dokumentasi tersedia di bawah

---

## 1. VARIABEL LINGKUNGAN (Backend PHP Server)

### Di Server (Production / Staging)
Salin `.env.example` ke `.env` dan isi sesuai server Anda:

```bash
cp .env.example .env
```

Isi `.env`:


---

## 2. FILE CONFIGURATION

### `backend/.env.example` (Template, tidak berisi rahasia)
```
# Database
GAMEKU_DB_HOST=127.0.0.1
GAMEKU_DB_PORT=3306
GAMEKU_DB_NAME=gamesku_store
GAMEKU_DB_USER=gamesku_app
GAMEKU_DB_PASS=your-secure-password

# Application
GAMEKU_APP_ORIGIN=https://store.example.com
GAMEKU_APP_PORT=8000

# Security
GAMEKU_SECURE_COOKIE=1
GAMEKU_DEBUG=0
```

### `backend/config/contoh.config.php` (Sumber referensi)
Perubahan yang dibutuhkan:

---

## 4. CLOUDFLARE CONFIGURATION (Draft)

*Cloudflare belum aktif. Jadikan selesai setelah domain diverifikasi.*

### DNS + TLS
- Alih domain ke Cloudflare (proxied)
- **SSL/TLS mode:** Full (atau Flexible jika tidak proxied)
- **Always Use HTTPS:** On
- **Automatic HTTPS Rewrites:** On

### Security
- **WAF:** Aktifkan Web Application Firewall
- **Rate Limiting:** Konfigurasi request per IP:
  - `/api/auth/masuk`: 10 requests per 60 seconds
  - `/api/pesanan`: 5 requests per 60 seconds
  - Other API: 100 requests per 60 seconds
- **Bots:** Challenge suspicious bots

### Caching
- **Cache level:** Cache static only
- **Cache TTL:** 1 hour untuk static assets, 0 untuk API

### Origin
- **Origin Server:** Sesuaikan dengan server PHP Anda
- **Origin Certificates:** Gunakan TLS certificate versi premium (optional)
- **Trusted Proxy:** Hanya sertakan IP range Cloudflare
- **Script Protection:** On (jika tersedia)

### Important
⚠️ Cloudflare **TIDAK** menggantikan validasi backend. PHP tetap:
- Memverifikasi session cookie
- Memverifikasi CSRF token
- Memverifikasi otorisasi semua request sensitif

---

## 5. INTEGRASI FRONTEND (Vercel)

### `frontend/.env.local` (Tidak diCommit)
```
VITE_API_BASE_URL=https://api.gamesku.store
VITE_APP_NAME=gamesku.store
```

### Pembangunan (Build)
```bash
# Backend (server)
cd backend
php -S localhost:8000 -t . api/index.php

# Frontend (Vercel)
cd frontend
npm run build
```

### Frontend Data Fetching (React Example)
```js
// Frontend tidak mengubah library, cukup konfigurasi URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
}
```

⚠️ Frontend **tidak** mengakses API_BASE di client. Semua request dari botol.

---

## 6. TESTING CHECKLIST

### Sebelum Deployment
- [ ] `php -l` pada semua file PHP
- [ ] `composer validate` (jika ada composer.json)
- [ ] Jalankan `php security-check.php`
- [ ] Cek endpoint `/api/sehat` (health check)
- [ ] Cek login dengan browser
- [ ] Cek CSRF token
- [ ] Cek admin status nonaktif

### Setelah Deployment
- [ ] Frontend berhasil di-build dan di-deploy
- [ ] Backend dapat diakses dari domain production
- [ ] CORS dibatasi ke domain production
- [ ] Cookie `secure` enabled
- [ ] Rate limiting aktif
- [ ] Security headers terlihat di response
- [ ] Error tidak bocor (tidak ada stack trace)
- [ ] Database dapat dihubungi

---

## 7. SAFETY

- Jangan masukkan kredensial ke Vercel environment variables
- Jangan deploy PHP source ke Vercel
- Jangan memakai wildcard `*` untuk CORS
- Jangan mengandalkan Cloudflare sebagai pengganti PHP
- Jangan menginstall DB sebelum konfigurasi tersedia

```php
// Sesudah domain diketahui:
'cors_origins' => [
    'https://store.example.com',  // production
    'http://localhost:5173',       // development
],
```

### `.gitignore` (Backend)
```
# Environment
.env

# Dependencies
/vendor/

# Config
config/config.php

# Logs
*.log

# Uploads
/uploads/
```

---

## 3. RUNTIME REQUIREMENTS

### PHP
- **Minimal:** PHP 7.4 (rekomendasi 8.1+)
- **Extensions:** `pdo`, `pdo_mysql`, `mbstring`, `iconv`
- **Module:** `session` (default)
- **OPcache:** Aktif untuk production

### Server
- Apache 2.4+ (mod_rewrite) atau Nginx 1.18+
- `uploads/` directory writable (`755` atau `775`)

### Web Server Config

**Apache (`.htaccess`):**
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ api/index.php [QSA,L]
</IfModule>
```

**Nginx:**
```nginx
server {
    listen 80;
    server_name api.gamesku.store;
    root /var/www/gamesku/backend;

    location / {
        try_files $uri $uri/ /api/index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }
}
```

| Variabel | Deskripsi | Contoh |
|----------|-----------|--------|
| `GAMEKU_DB_HOST` | Host database MySQL | `127.0.0.1` atau `db.example.com` |
| `GAMEKU_DB_PORT` | Port database MySQL | `3306` |
| `GAMEKU_DB_NAME` | Nama database | `gamesku_store` |
| `GAMEKU_DB_USER` | Username database (tingkat minimum) | `gamesku_app` |
| `GAMEKU_DB_PASS` | Password database | (ragam) |
| `GAMEKU_APP_ORIGIN` | Origin frontend yang diizinkan (CORS) | `https://store.example.com` |
| `GAMEKU_APP_PORT` | Port server PHP | `8000` atau `80` |
| `GAMEKU_SECURE_COOKIE` | Paksa cookie HTTPS | `1` (production), `0` (localhost) |
| `GAMEKU_DEBUG` | Mode debug | `0` (production), `1` (development) |

### Di Vercel (Frontend Only)
**HANYA** URL backend. Jangan masukkan DB credential ke Vercel!

| Variabel | Deskripsi | Contoh |
|----------|-----------|--------|
| `VITE_API_BASE_URL` | Base URL backend PHP | `https://api.gamesku.store` |
| `VITE_APP_NAME` | Nama aplikasi (opsional) | `gamesku.store` |

**Catatan Vercel:**
- Frontend build di Vercel akan membaca `VITE_API_BASE_URL`
- Hanya gunakan `.env.local` di frontend (TIDAK diCommit)
- Jangan masukkan `GAMEKU_DB_*` ke Vercel
- Backend PHP di server terpisah, tidak di Vercel