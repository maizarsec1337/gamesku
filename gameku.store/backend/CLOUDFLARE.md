# Cloudflare & Infrastructure — gamesku.store

*Cloudflare belum aktif. Dokumentasi ini disiapkan untuk konfigurasi setelah domain diverifikasi.*

---

## 1. PRINSIP UTAMA

> **Cloudflare bukan pengganti backend.** PHP tetap memverifikasi:
> - Session cookie (session_id, security)
> - CSRF token
> - Otorisasi (Auth::wajib()) semua request sensitif
>
> Cloudflare hanya memfilter request di perimeter.

---

## 2. TLS / HTTPS CONFIGURATION

### Settings
| Setting | Value |
|---------|-------|
| SSL/TLS mode | **Full** (or Flexible jika tidak proxied) |
| Always Use HTTPS | **On** |
| Automatic HTTPS Rewrites | **On** |
| Min TLS Version | **1.2** |
| TLS Ciphers | Modern (ECDHE, AES-GCM) |

### Origin
- Gunakan **Origin Certificates** (premium) untuk TLS endpoint origin
- **Origin Server:** Sesuaikan dengan server PHP (misal `api.gamesku.store`)

---

## 3. WAF (Web Application Firewall)

### Rules
| Rule | Mode | Notes |
|------|------|-------|
| OWASP SQL Injection | Block | Aktifkan |
| OWASP XSS | Block | Aktifkan |
| OWASP RCE | Block | Aktifkan |
| Generic Detection | Monitor | Review logs |
| Rate Limiting (login) | Challenge | 10 req/60s per IP |
| Rate Limiting (checkout) | Managed Challenge | 5 req/60s per IP |
| Rate Limiting (API) | Managed Challenge | 100 req/60s per IP |
| Bot Fight Mode | On | Simpan biaya server |
| Security Level | Medium+ | Sesuaikan dengan kebutuhan |

### Custom WAF Rules
```text
# Block requests with SQL injection patterns
(http.request.method == "POST") and
(http.request.body.raw contains "UNION") or
(http.request.body.raw contains "SELECT")

# Block direct access to sensitive files
(http.host eq "api.gamesku.store") and
(http.request.uri.path contains ".env") or
(http.request.uri.path contains "config.php")

# Require auth for admin endpoints
(http.host eq "api.gamesku.store") and
(http.request.uri.path startsWith "/api/auth") and
(http.request.method != "OPTIONS")
```

⚠️ WAF rules diberikan sebagai reference. NAVIGASI atur di Cloudflare dashboard.

---

## 4. RATE LIMITING (Cloudflare)

### Table
| Endpoint | Rate Limit | Burst | Mode |
|----------|-----------|-------|------|
| `/api/auth/masuk` | 10 req/IP/60s | 5 | Challenge |
| `/api/auth/daftar` | 5 req/IP/60s | 3 | Managed Challenge |
| `/api/pesanan` | 5 req/IP/60s | 2 | Managed Challenge |
| `/api/promo/cek` | 20 req/IP/60s | 10 | Managed Challenge |
| All other API | 100 req/IP/60s | 50 | Managed Challenge |

### Notes
- Cloudflare rate limiting berjalan **di perimeter** (before reaching PHP)
- Backend rate limiting (`AuthRateLimiter`) adalah **defense in depth**
- Both should be configured for defense-in-depth

---

## 5. CACHE CONFIGURATION

| Cache Type | Cache Level | TTL |
|------------|-------------|-----|
| Static assets (`.css`, `.js`, `.png`, `.jpg`) | Cache static | 1 hour |
| API responses (`/api/*`) | Cache off | Forever |
| HTML pages | Cache static | 5 minutes |

### Cache Rules
- Do not cache authenticated responses
- Do not cache responses with `no-store` header

---

## 6. ORIGIN SERVER CONFIGURATION

### DNS Records
```
api    →    your-server-ip   (proxied: On)
www    →    your-server-ip   (proxied: Off, unless using www for frontend)
```

### Server Settings
| Setting | Value |
|---------|-------|
| SSL | Full (strict) |
| Always Use HTTPS | On |
| HTTP/3 | On (optional) |
| QUIC | On (optional) |
| Min TLS Version | 1.2 |
| Origin Certificates | Premium or self-signed |

### Trusted Proxies
- Add Cloudflare IP ranges only
- Do NOT trust `X-Forwarded-For` from untrusted sources
- Use `CF-Connecting-IP` header for real IP when proxied

---

## 7. VALINDAI (Validasi)

Setelah konfigurasi selesai:
1. **Cek TLS:** `https://api.gamesku.store/api/sehat` should work
2. **Cek HTTP → HTTPS:** Non-www should redirect to www
3. **Cek Origin:** Direct access to origin (without Cloudflare) should work
4. **Cek Rate Limiting:** 11th request to `/api/auth/masuk` should be blocked at Cloudflare level
5. **Cek WAF:** Malicious request should be blocked at Cloudflare level

---

## 8. DOCUMENTATION STATUS

| Item | Status | Target |
|------|--------|--------|
| Domain terverifikasi | ⏳ | Setelah deployment |
| Cloudflare account | ⏳ | Sesuai timeline |
| SSL/TLS | ⏳ | Setelah domain terverifikasi |
| WAF rules | ⏳ | Jika ada budget | 
| Rate limiting | ⏳ | Setelah domain terverifikasi |
| Origin certificates | ⏳ | Optional |

⚠️ **Cloudflare belum aktif.** Dokumentasi ini adalah template deployment, bukan status aktual.
