# Gamesku Backend Security Service

Modul keamanan modular yang terintegrasi dengan backend PHP gamesku.store.

## Struktur
- core/: konfigurasi, kernel, logger, event dispatcher
- auth/: password policy, session, brute force guard
- authorization/: RBAC dan permission guard
- api-security/: validasi request, CORS
- validation/: validasi input
- rate-limiting/: layanan rate limit
- security-headers/: header keamanan
- csrf/: token CSRF
- secrets/: inventaris secret
- audit/: audit log
- monitoring/: deteksi ancaman
- threat-detection/: rule engine
- vulnerability-scanning/: scanner statis
- dependency-audit/: audit dependency
- incident-response/: workflow insiden
- integrations/: integrasi backend
- tests/: uji modul

## Menjalankan test
php backend/security-service/tests/SecurityServiceTest.php

## Endpoint admin (role admin/superadmin)
GET /api/keamanan/audit
GET /api/keamanan/incidents
GET /api/keamanan/threats
POST /api/keamanan/incident
PATCH /api/keamanan/incident/{id}
POST /api/keamanan/scan
