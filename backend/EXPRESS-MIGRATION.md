# Gameku Express / Prisma migration

This backend is a parallel replacement for the PHP API. Keep `api/`, `src/` PHP controllers, the old database, and existing uploaded files until parity and data verification are complete. Do not point a live shop at this API until the acceptance checks below pass.

## Run locally

Use Node.js 20 or newer. From `backend/`, copy `.env.example` to `.env` and fill values locally. Never send credentials in chat or commit `.env`.

```powershell
npm ci
npm run build
npm run db:validate
npm start
```

The API listens on port 8000 by default; health endpoint is `/api/sehat`. React runs separately from `frontend/`; set its public `VITE_API_BASE_URL` to the API origin only. Existing PHP startup remains available while migration is in progress.

## Supabase connections and schema changes

Set backend-only `DATABASE_URL` to Supavisor transaction pooling (port 6543, `connection_limit=1`) for Vercel Functions. Set `DIRECT_URL` to the direct database endpoint or Supavisor session connection for schema migration commands. The Prisma schema's `directUrl` is for migration operations; runtime API queries use `DATABASE_URL`. Use separate Supabase projects or isolated databases for development, preview, and production. Never run integration tests or transfer tooling against production as a test.

Review every SQL migration and take a verified database backup before applying it. Apply committed migrations with `npm run db:migrate`; develop future migrations against a disposable development database with `npx prisma migrate dev --name descriptive_change`. Do not run `db push`, reset, or seed against an existing database.

## Legacy data transfer

The transfer tool supports MySQL and PostgreSQL sources, checks row counts and orphan references, preserves legacy primary keys, and only inserts missing rows. It refuses a populated target unless `--resume` is explicitly supplied; on resume it verifies existing row values rather than overwriting them. A transfer requires both a legacy connection and a separately created, verified SQL backup file plus its SHA-256 digest.

1. Back up the legacy database with its native dump tool and keep the dump outside the project.
2. Fill `LEGACY_DATABASE_URL`, `LEGACY_BACKUP_FILE`, `LEGACY_BACKUP_SHA256`, `DATABASE_URL`, and `DIRECT_URL` in the local backend environment. Do not use production credentials for a dry run.
3. Apply the reviewed Prisma migrations to an empty, non-production Supabase project.
4. Run `npm run db:transfer:check`, review every count and relationship finding, then run `npm run db:transfer`.
5. Compare the report and independent source/target counts. For an interrupted import, inspect the target before deciding whether `npm run db:transfer -- --resume` is appropriate.

The tool has not been run in this checkout because neither database connection nor a legacy database backup was supplied. A filesystem backup of the project is not a database dump.

## Authentication, uploads, and service limits

Admin and customer password hashes remain compatible with PHP bcrypt hashes, including PHP's `$2y$` prefix. The API retains the `PHPSESSID` cookie name, CSRF validation, role checks, and server-side sessions. The PHP file-backed session contents are not readable by the new database-backed session store, so users must sign in again after cutover; account passwords and roles remain in the imported rows.

Configure an S3-compatible persistent object store using the backend-only `S3_*` variables for production uploads. The browser uploads directly using a short-lived signed URL, avoiding the Vercel Function 4.5 MB request/response body limit. Preserve and separately migrate existing `backend/uploads` files; this code does not copy old files into object storage automatically. Vercel Functions do not provide durable local upload storage or long-running workers/WebSockets. No WebSocket server was found in the legacy app. Chat requires a configured HTTPS provider and returns unavailable while unset.

## Deploy and rollback

Deploy `backend/` as the API project and `frontend/` as the React project. Configure backend secrets in the hosting environment only; frontend `VITE_*` variables must contain public values only. Set `ALLOWED_ORIGINS` to the exact frontend origin, configure secure cookies, and use a shared registrable domain when possible. For cross-site cookies, set `SESSION_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true`. Deploy the frontend API origin and backend CORS settings together.

Vercel Express support uses one serverless function for the API; the bundled anime catalogue is included by `vercel.json`. Hobby is restricted to personal, non-commercial use, so it is not appropriate for an active commercial store. Use an eligible paid plan or another suitable host for a live shop. Keep the PHP application and old database available for rollback. After new writes begin, switching back requires reconciling those writes; a simple code rollback does not reverse migrated data.

## Current parity status

Ported in the new Express API: session/CSRF auth, bcrypt login and customer registration, category/product/catalog reads and admin CRUD, promo validation and checkout, orders, manual payment confirmation, dashboard, reseller applications/approvals/dashboard/history, reviews, media upload/delete, activity, conversations/messages, optional AI chat, and anime catalogue/playback lookup. The legacy security-audit/scanner and incident-management endpoints have not been ported and have no frontend consumer in the audited JSX. Preserve the PHP API for those endpoints until replacements and parity tests are complete. No gateway integration was active in the audited code.

Database-backed login, authorization, CRUD, checkout, payment, and transfer integration tests require an isolated migrated database and are still pending. Build and database-free route checks do not establish database parity.
