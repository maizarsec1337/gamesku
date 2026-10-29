import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { prisma } from './db.js'
import { recordSecurityAudit, recordThreat, runSecurityScan } from './security.js'

const app = express()
const production = process.env.NODE_ENV === 'production'
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
const origins = (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || 'http://localhost:5173')
  .split(',').map((item) => item.trim()).filter(Boolean)
const cwd = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(cwd, '../uploads'))
const projectRoot = path.resolve(cwd, '../..')
fs.mkdirSync(uploadDir, { recursive: true })
const s3Bucket = process.env.S3_BUCKET || ''
const s3 = process.env.S3_ENDPOINT && s3Bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
  ? new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || 'auto', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } })
  : null
const money = (value) => BigInt(Math.max(0, Math.trunc(Number(value) || 0)))
const id = (prefix) => `${prefix}-${Math.floor(Date.now() / 1000).toString(36)}-${crypto.randomBytes(3).toString('hex')}`
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const camelKey = (key) => key.replace(/_([a-z])/g, (_match, char) => char.toUpperCase())
const apiOrigin = String(process.env.PUBLIC_API_ORIGIN || '').replace(/\/+$/, '')
const apiShape = (value) => {
  if (Array.isArray(value)) return value.map(apiShape)
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'sandi_hash').map(([key, item]) => {
    const shaped = apiShape(item)
    return [camelKey(key), typeof shaped === 'string' && /^\/uploads\//.test(shaped) && apiOrigin ? `${apiOrigin}${shaped}` : shaped]
  }))
  return typeof value === 'bigint' ? Number(value) : value
}
const ok = (res, data = null, pesan = '', status = 200) => res.status(status).json({ ok: true, data: apiShape(data), pesan })
const fail = (status, message) => Object.assign(new Error(message), { status })
const num = (value) => typeof value === 'bigint' ? Number(value) : value
const safe = (value) => JSON.parse(JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? Number(v) : v))
const body = (req) => req.body && typeof req.body === 'object' ? req.body : {}
const str = (value, max = 255) => String(value ?? '').trim().slice(0, max)

app.set('trust proxy', production ? 1 : false)
app.use(cors({ origin(origin, cb) {
  if (!origin || origins.includes(origin)) return cb(null, true)
  return cb(fail(403, 'Origin tidak diizinkan.'))
}, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-HTTP-Method-Override'] }))
app.use(express.json({ limit: '256kb' }))
app.use(express.urlencoded({ extended: false, limit: '256kb' }))

class PrismaSessionStore extends session.Store {
  get(sid, cb) {
    prisma.session.findUnique({ where: { sid } }).then((row) => cb(null, row && row.expire > new Date() ? row.sess : null)).catch(cb)
  }
  set(sid, sess, cb = () => {}) {
    const expire = new Date(Date.now() + Number(sess.cookie?.maxAge || 1_800_000))
    prisma.session.upsert({ where: { sid }, create: { sid, sess, expire }, update: { sess, expire } }).then(() => cb()).catch(cb)
  }
  touch(sid, sess, cb = () => {}) {
    prisma.session.updateMany({ where: { sid }, data: { expire: new Date(Date.now() + Number(sess.cookie?.maxAge || 1_800_000)) } }).then(() => cb()).catch(cb)
  }
  destroy(sid, cb = () => {}) { prisma.session.deleteMany({ where: { sid } }).then(() => cb()).catch(cb) }
}
function prismaRateStore(windowMs) {
  return {
    windowMs,
    async increment(clientKey) {
      const key = crypto.createHash('sha256').update(`${windowMs}:${clientKey}`).digest('hex')
      const [row] = await prisma.$queryRawUnsafe(`INSERT INTO "api_rate_limit" ("id", "hits", "reset_at") VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond')) ON CONFLICT ("id") DO UPDATE SET "hits" = CASE WHEN "api_rate_limit"."reset_at" <= NOW() THEN 1 ELSE "api_rate_limit"."hits" + 1 END, "reset_at" = CASE WHEN "api_rate_limit"."reset_at" <= NOW() THEN NOW() + ($2 * INTERVAL '1 millisecond') ELSE "api_rate_limit"."reset_at" END RETURNING "hits", "reset_at"`, key, windowMs)
      if (crypto.randomInt(100) === 0) prisma.$executeRawUnsafe('DELETE FROM "api_rate_limit" WHERE "reset_at" < NOW() - INTERVAL \'1 day\'').catch(() => {})
      return { totalHits: Number(row.hits), resetTime: row.reset_at }
    },
    async decrement(clientKey) {
      const key = crypto.createHash('sha256').update(`${windowMs}:${clientKey}`).digest('hex')
      await prisma.$executeRawUnsafe('UPDATE "api_rate_limit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "id" = $1', key)
    },
    async resetKey(clientKey) {
      const key = crypto.createHash('sha256').update(`${windowMs}:${clientKey}`).digest('hex')
      await prisma.apiRateLimit.deleteMany({ where: { id: key } })
    },
  }
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  if (production) throw new Error('SESSION_SECRET wajib diisi minimal 32 karakter.')
  process.env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex')
}
app.use(session({
  name: 'PHPSESSID', secret: process.env.SESSION_SECRET, store: new PrismaSessionStore(),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: process.env.SESSION_SAME_SITE || 'lax', secure: process.env.SESSION_COOKIE_SECURE === 'true' || production, domain: process.env.SESSION_COOKIE_DOMAIN || undefined, maxAge: 30 * 60 * 1000, path: '/' },
}))

function trackThreat(req, type) {
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') return
  recordThreat(prisma, type, { path: req.path, method: req.method }).catch(() => {})
}
const limited = (type, message) => (req, res) => { trackThreat(req, type); res.status(429).json({ ok: false, pesan: message }) }
const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, store: prismaRateStore(60_000), passOnStoreError: false, standardHeaders: true, legacyHeaders: false, handler: limited('login_fail', 'Terlalu banyak percobaan. Coba lagi sebentar.') })
const chatLimiter = rateLimit({ windowMs: 60_000, limit: 20, store: prismaRateStore(60_000), passOnStoreError: false, standardHeaders: true, legacyHeaders: false, handler: limited('http_4xx', 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.') })
const registrationLimiter = rateLimit({ windowMs: 300_000, limit: 5, store: prismaRateStore(300_000), passOnStoreError: false, standardHeaders: true, legacyHeaders: false, handler: limited('http_4xx', 'Terlalu banyak pendaftaran. Coba lagi nanti.') })
const reviewLimiter = rateLimit({ windowMs: 60_000, limit: 10, store: prismaRateStore(60_000), passOnStoreError: false, standardHeaders: true, legacyHeaders: false, handler: limited('http_4xx', 'Terlalu banyak ulasan. Tunggu sebentar lalu coba lagi.') })
const resellerApplicationLimiter = rateLimit({ windowMs: 300_000, limit: 5, keyGenerator: (req) => req.session.pembeli?.id ? `buyer:${req.session.pembeli.id}` : `ip:${ipKeyGenerator(req.ip)}`, store: prismaRateStore(300_000), passOnStoreError: false, standardHeaders: true, legacyHeaders: false, handler: limited('http_4xx', 'Anda sudah mengirimkan banyak pengajuan. Coba lagi nanti.') })
function issueCsrf(req) { req.session.csrf ||= crypto.randomBytes(32).toString('hex'); return req.session.csrf }
function csrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const token = req.get('X-CSRF-Token') || ''
  const expected = Buffer.from(req.session.csrf || '')
  const provided = Buffer.from(token)
  if (!expected.length || expected.length !== provided.length || !crypto.timingSafeEqual(provided, expected)) {
    trackThreat(req, 'csrf_fail')
    return next(fail(403, 'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.'))
  }
  next()
}
function admin(req, res, next) {
  if (!req.session.admin) return next(fail(401, 'Perlu masuk sebagai admin.'))
  prisma.admin.findUnique({ where: { id: req.session.admin.id }, select: { id: true, pengguna: true, nama: true, email: true, peran: true, status: true } }).then(async (current) => {
    if (!current || current.status !== 'Aktif') {
      await new Promise((resolve) => req.session.destroy(() => resolve()))
      res.clearCookie('PHPSESSID', { path: '/' })
      return next(fail(401, 'Sesi admin tidak aktif. Silakan masuk kembali.'))
    }
    req.session.admin = current
    prisma.admin.update({ where: { id: current.id }, data: { masuk_terakhir: new Date() } }).catch(() => {})
    return next()
  }).catch(next)
}
function role(...roles) { return (req, _res, next) => !roles.length || roles.includes(req.session.admin?.peran) ? next() : next(fail(403, 'Akses ditolak: role tidak cukup.')) }
function buyer(req, res, next) {
  if (!req.session.pembeli) return next(fail(401, 'Perlu masuk terlebih dahulu.'))
  prisma.pelanggan.findFirst({ where: { id: req.session.pembeli.id, status: 'Aktif' }, select: { id: true, nama: true, username: true, email: true } }).then(async (current) => {
    if (!current) {
      delete req.session.pembeli
      res.clearCookie('PHPSESSID', { path: '/' })
      return next(fail(401, 'Sesi pelanggan tidak aktif. Silakan masuk kembali.'))
    }
    req.session.pembeli = current
    return next()
  }).catch(next)
}
function activeIdentity(req, res, next) {
  if (req.session.admin) return admin(req, res, next)
  if (req.session.pembeli) return buyer(req, res, next)
  return next(fail(401, 'Perlu masuk terlebih dahulu.'))
}
function idMatch(value) { return /^[\w-]{1,40}$/.test(String(value || '')) }
const mutate = [csrf]

app.get('/api/sehat', wrap(async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; return ok(res, { layanan: 'gamesku-store', waktu: new Date().toISOString(), database: 'tersambung' }) }
  catch { return res.status(200).json({ ok: true, data: { layanan: 'gamesku-store', waktu: new Date().toISOString(), database: 'gagal' }, pesan: '' }) }
}))
app.get('/api/keamanan/audit', admin, wrap(async (req, res) => {
  const where = { ...(req.query.action ? { action: str(req.query.action, 120) } : {}), ...(req.query.outcome ? { outcome: str(req.query.outcome, 30) } : {}) }
  const rows = await prisma.securityAuditEvent.findMany({ where, orderBy: { ts: 'desc' }, take: 200 })
  return res.json({ ok: true, data: rows.map((row) => ({ ts: row.ts.toISOString(), correlation_id: row.correlation_id, actor: row.actor, action: row.action, resource: row.resource, outcome: row.outcome, meta: row.meta })) })
}))
app.get('/api/keamanan/incidents', admin, wrap(async (req, res) => {
  const where = req.query.status ? { status: str(req.query.status, 20) } : {}
  return ok(res, await prisma.securityIncident.findMany({ where, orderBy: { created_at: 'desc' }, take: 200 }))
}))
app.get('/api/keamanan/threats', admin, wrap(async (_req, res) => {
  const windowSeconds = Math.max(60, Math.min(86400, Number(process.env.SECURITY_WINDOW_SECONDS) || 300))
  const start = new Date(Date.now() - windowSeconds * 1000)
  const grouped = await prisma.securityThreatEvent.groupBy({ by: ['type'], where: { ts: { gte: start } }, _count: { _all: true } })
  const counts = Object.fromEntries(grouped.map((row) => [row.type, row._count._all]))
  const thresholds = { login_failures: Number(process.env.SECURITY_LOGIN_THRESHOLD) || 10, http_4xx: Number(process.env.SECURITY_4XX_THRESHOLD) || 20, http_5xx: Number(process.env.SECURITY_5XX_THRESHOLD) || 5 }
  const findings = []
  if ((counts.login_fail || 0) >= thresholds.login_failures) findings.push({ type: 'login_spike', severity: 'high', count: counts.login_fail })
  if ((counts.http_4xx || 0) >= thresholds.http_4xx) findings.push({ type: 'http_4xx_spike', severity: 'medium', count: counts.http_4xx })
  if ((counts.http_5xx || 0) >= thresholds.http_5xx) findings.push({ type: 'http_5xx_spike', severity: 'high', count: counts.http_5xx })
  if ((counts.csrf_fail || 0) >= thresholds.http_4xx) findings.push({ type: 'csrf_spike', severity: 'high', count: counts.csrf_fail })
  return ok(res, findings)
}))
app.post('/api/keamanan/incident', admin, csrf, wrap(async (req, res) => {
  const input = body(req), title = str(input.title || 'Insiden keamanan', 255), severity = str(input.severity || 'medium', 20).toLowerCase()
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) throw fail(422, 'Tingkat keparahan insiden tidak valid.')
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '')
  const row = await prisma.securityIncident.create({ data: { id: `INC-${dateKey}-${crypto.randomBytes(3).toString('hex')}`, title, severity, status: 'detected', meta: { sumber: 'api' } } })
  await recordSecurityAudit(prisma, req, 'incident.create', 'success', { resource: row.id }).catch(() => {})
  return ok(res, { id: row.id }, 'Insiden dibuat.', 201)
}))
app.put('/api/keamanan/incident/:id', admin, csrf, wrap(async (req, res) => {
  const status = str(body(req).status, 20), allowed = ['detected', 'investigating', 'contained', 'resolved', 'closed']
  if (!allowed.includes(status)) throw fail(400, 'Transisi insiden gagal.')
  const current = await prisma.securityIncident.findUnique({ where: { id: req.params.id } })
  if (!current) throw fail(400, 'Transisi insiden gagal.')
  const row = await prisma.securityIncident.update({ where: { id: current.id }, data: { status, updated_at: new Date() } })
  await recordSecurityAudit(prisma, req, 'incident.transition', 'success', { resource: row.id, status }).catch(() => {})
  return ok(res, { id: row.id, status: row.status }, 'Insiden diperbarui.')
}))
app.patch('/api/keamanan/incident/:id', admin, csrf, wrap(async (req, res) => {
  const status = str(body(req).status, 20), allowed = ['detected', 'investigating', 'contained', 'resolved', 'closed']
  if (!allowed.includes(status)) throw fail(400, 'Transisi insiden gagal.')
  const current = await prisma.securityIncident.findUnique({ where: { id: req.params.id } })
  if (!current) throw fail(400, 'Transisi insiden gagal.')
  const row = await prisma.securityIncident.update({ where: { id: current.id }, data: { status, updated_at: new Date() } })
  await recordSecurityAudit(prisma, req, 'incident.transition', 'success', { resource: row.id, status }).catch(() => {})
  return ok(res, { id: row.id, status: row.status }, 'Insiden diperbarui.')
}))
app.post('/api/keamanan/scan', admin, csrf, wrap(async (req, res) => {
  const { findings } = runSecurityScan(projectRoot)
  await recordSecurityAudit(prisma, req, 'security.scan', 'success', { jumlah: findings.length }).catch(() => {})
  return ok(res, findings, 'Pemindaian selesai.')
}))
app.get('/api/auth/csrf-token', (req, res) => ok(res, { csrf_token: issueCsrf(req) }))
app.get('/api/auth/csrf', (req, res) => ok(res, { csrf_token: issueCsrf(req) }))
app.get('/api/auth/saya', wrap(async (req, res) => {
  if (!req.session.admin) return ok(res, { admin: null })
  const user = await prisma.admin.findUnique({ where: { id: req.session.admin.id }, select: { id: true, pengguna: true, nama: true, email: true, peran: true, status: true } })
  if (!user || user.status !== 'Aktif') { delete req.session.admin; return ok(res, { admin: null }) }
  req.session.admin = user
  prisma.admin.update({ where: { id: user.id }, data: { masuk_terakhir: new Date() } }).catch(() => {})
  return ok(res, { admin: user })
}))
app.post('/api/auth/masuk', loginLimiter, csrf, wrap(async (req, res) => {
  const userInput = str(body(req).pengguna, 150)
  const password = String(body(req).sandi ?? '')
  if (!userInput || !password) throw fail(400, 'Pengguna dan sandi wajib diisi.')
  if (Buffer.byteLength(password, 'utf8') > 72) throw fail(401, 'Pengguna atau sandi salah.')
  const user = await prisma.admin.findFirst({ where: { OR: [{ pengguna: { equals: userInput, mode: 'insensitive' } }, { email: { equals: userInput, mode: 'insensitive' } }] } })
  const hash = user?.sandi_hash?.replace(/^\$2y\$/, '$2b$')
  if (!user || !await bcrypt.compare(password, hash || '$2b$12$invalid.invalid.invalid.invalid.invalid.invalid.invalid.invalid')) { trackThreat(req, 'login_fail'); throw fail(401, 'Pengguna atau sandi salah.') }
  if (user.status !== 'Aktif') throw fail(403, 'Akun admin tidak aktif.')
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
  req.session.admin = { id: user.id, pengguna: user.pengguna, nama: user.nama, email: user.email, peran: user.peran || 'admin' }
  issueCsrf(req)
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()))
  await loginLimiter.resetKey(req.ip)
  return ok(res, req.session.admin, 'Berhasil masuk.')
}))
app.post('/api/auth/keluar', csrf, wrap(async (req, res) => { await new Promise((resolve) => req.session.destroy(() => resolve())); res.clearCookie('PHPSESSID', { path: '/' }); return ok(res, null, 'Berhasil keluar.') }))
app.get('/api/auth/admin', admin, role('superadmin'), wrap(async (_req, res) => ok(res, await prisma.admin.findMany({ select: { id: true, pengguna: true, nama: true, email: true, peran: true, status: true, dibuat_pada: true, masuk_terakhir: true }, orderBy: { id: 'asc' } }))))
app.post('/api/auth/daftar', admin, role('superadmin'), csrf, wrap(async (req, res) => {
  const input = body(req), pengguna = str(input.pengguna, 60), sandi = String(input.sandi || '')
  if (!pengguna || !sandi || Buffer.byteLength(sandi, 'utf8') > 72 || sandi.length < 8) throw fail(422, 'Pengguna dan sandi minimal 8 karakter wajib diisi.')
  if (!['admin', 'superadmin'].includes(input.peran || 'admin')) throw fail(422, 'Role admin tidak valid.')
  const record = await prisma.admin.create({ data: { pengguna, nama: str(input.nama || pengguna, 120), email: str(input.email, 150).toLowerCase(), sandi_hash: await bcrypt.hash(sandi, 12), peran: input.peran || 'admin', status: 'Aktif' }, select: { id: true, pengguna: true, nama: true, email: true, peran: true, status: true } })
  return ok(res, record, 'Admin ditambahkan.', 201)
}))
app.put('/api/auth/admin/:id', admin, role('superadmin'), csrf, wrap(async (req, res) => {
  const targetId = Number(req.params.id); if (!Number.isSafeInteger(targetId) || targetId < 1) throw fail(400, 'ID admin tidak valid.')
  const input = body(req), current = await prisma.admin.findUnique({ where: { id: targetId } }); if (!current) throw fail(404, 'Admin tidak ditemukan.')
  const data = {}
  if (input.status !== undefined) { if (!['Aktif', 'Nonaktif'].includes(input.status)) throw fail(422, 'Status admin tidak valid.'); data.status = input.status }
  if (input.peran !== undefined) { if (!['admin', 'superadmin'].includes(input.peran)) throw fail(422, 'Role admin tidak valid.'); data.peran = input.peran }
  if (current.id === req.session.admin.id && (data.peran === 'admin' || data.status === 'Nonaktif')) throw fail(409, 'Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.')
  const adminCount = await prisma.admin.count({ where: { peran: 'superadmin', status: 'Aktif' } })
  if (current.peran === 'superadmin' && current.status === 'Aktif' && (data.peran === 'admin' || data.status === 'Nonaktif') && adminCount <= 1) throw fail(409, 'Superadmin aktif terakhir tidak dapat dinonaktifkan.')
  const record = await prisma.admin.update({ where: { id: current.id }, data, select: { id: true, pengguna: true, nama: true, email: true, peran: true, status: true } })
  return ok(res, record, 'Admin diperbarui.')
}))
app.delete('/api/auth/admin/:id', admin, role('superadmin'), csrf, wrap(async (req, res) => {
  const targetId = Number(req.params.id); if (!Number.isSafeInteger(targetId) || targetId < 1) throw fail(400, 'ID admin tidak valid.')
  const current = await prisma.admin.findUnique({ where: { id: targetId } }); if (!current) throw fail(404, 'Admin tidak ditemukan.')
  if (current.id === req.session.admin.id) throw fail(409, 'Anda tidak dapat menghapus akun sendiri.')
  const activeSuper = current.peran === 'superadmin' && current.status === 'Aktif' ? await prisma.admin.count({ where: { peran: 'superadmin', status: 'Aktif' } }) : 2
  if (activeSuper <= 1) throw fail(409, 'Superadmin aktif terakhir tidak dapat dihapus.')
  await prisma.admin.delete({ where: { id: targetId } }); return ok(res, { id: targetId }, 'Admin dihapus.')
}))

app.post('/api/pelanggan/masuk', loginLimiter, csrf, wrap(async (req, res) => {
  const email = str(body(req).email, 150).toLowerCase(), password = String(body(req).sandi ?? '')
  const customer = await prisma.pelanggan.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  const hash = customer?.sandi_hash?.replace(/^\$2y\$/, '$2b$')
  if (Buffer.byteLength(password, 'utf8') > 72 || !customer || !hash || !await bcrypt.compare(password, hash)) { trackThreat(req, 'login_fail'); throw fail(401, 'Email atau kata sandi salah.') }
  if (customer.status !== 'Aktif') throw fail(403, 'Akun tidak aktif.')
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
  req.session.pembeli = { id: customer.id, nama: customer.nama, username: customer.username, email: customer.email }
  issueCsrf(req); await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve())); await loginLimiter.resetKey(req.ip)
  return ok(res, req.session.pembeli, 'Berhasil masuk.')
}))
app.get('/api/pelanggan/saya', wrap(async (req, res) => {
  const ses = req.session.pembeli
  if (!ses) return ok(res, { pelanggan: null, pembeli: null })
  const current = await prisma.pelanggan.findFirst({ where: { id: ses.id, status: 'Aktif' }, select: { id: true, nama: true, username: true, email: true } })
  if (!current) { delete req.session.pembeli; return ok(res, { pelanggan: null, pembeli: null }) }
  req.session.pembeli = current
  return ok(res, { pelanggan: current, pembeli: current })
}))
app.post('/api/pelanggan/keluar', csrf, wrap(async (req, res) => { delete req.session.pembeli; return ok(res, null, 'Berhasil keluar.') }))

app.get('/api/aktivitas', admin, role('superadmin'), wrap(async (req, res) => ok(res, await prisma.aktivitas.findMany({ orderBy: { dibuat_pada: 'desc' }, take: Math.max(1, Math.min(200, Number(req.query.batas) || 50)) }))))
app.delete('/api/aktivitas', admin, role('superadmin'), csrf, wrap(async (_req, res) => { await prisma.aktivitas.deleteMany(); return ok(res, null, 'Aktivitas dikosongkan.') }))

app.get('/api/reseller/saya', buyer, wrap(async (req, res) => ok(res, await prisma.resellerPengajuan.findFirst({ where: { pelanggan_id: req.session.pembeli.id }, orderBy: { dibuat_pada: 'desc' } }))))
app.get('/api/reseller', admin, role('superadmin'), wrap(async (req, res) => {
  const halaman = Math.max(1, Math.round(Number(req.query.halaman) || 1)), batas = 20
  const cari = str(req.query.cari, 120), status = ['pending', 'approved', 'rejected'].includes(str(req.query.status, 20).toLowerCase()) ? str(req.query.status, 20).toLowerCase() : ''
  const where = { ...(status ? { status } : {}), ...(cari ? { OR: ['nama', 'email', 'username'].map((field) => ({ [field]: { contains: cari, mode: 'insensitive' } })) } : {}) }
  const [data, jumlah] = await Promise.all([
    prisma.resellerPengajuan.findMany({ where, include: { admin: { select: { nama: true } } }, orderBy: [{ dibuat_pada: 'desc' }, { id: 'desc' }], skip: (halaman - 1) * batas, take: batas }),
    prisma.resellerPengajuan.count({ where }),
  ])
  return ok(res, { data, jumlah, halaman, batas, offset: (halaman - 1) * batas })
}))
app.get('/api/reseller/dashboard', buyer, wrap(async (req, res) => {
  const ajuan = await prisma.resellerPengajuan.findFirst({ where: { pelanggan_id: req.session.pembeli.id, status: 'approved' }, orderBy: { dibuat_pada: 'desc' } })
  if (!ajuan) throw fail(403, 'Dashboard reseller hanya tersedia untuk reseller yang telah disetujui.')
  const [statistik, pesanan] = await Promise.all([
    prisma.pesanan.aggregate({ where: { pelanggan_id: req.session.pembeli.id }, _count: { _all: true }, _sum: { total: true } }),
    prisma.pesanan.findMany({ where: { pelanggan_id: req.session.pembeli.id }, select: { id: true, produk_ringkas: true, kategori: true, metode: true, total: true, status: true, dibuat_pada: true }, orderBy: [{ dibuat_pada: 'desc' }, { id: 'desc' }], take: 10 }),
  ])
  const berhasil = await prisma.pesanan.aggregate({ where: { pelanggan_id: req.session.pembeli.id, status: 'Berhasil' }, _sum: { total: true } })
  return ok(res, { ajuan, statistik: { jumlahPesanan: statistik._count._all, totalBerhasil: Number(berhasil._sum.total || 0n), totalSemua: Number(statistik._sum.total || 0n) }, catatan: 'Harga reseller, komisi, dan katalog khusus belum dikonfigurasi; nilai yang ditampilkan adalah data pesanan nyata.', pesananTerbaru: pesanan.map((row) => ({ id: row.id, produk: row.produk_ringkas, kategori: row.kategori, metode: row.metode, total: Number(row.total), status: row.status, dibuatPada: row.dibuat_pada })) })
}))
app.get('/api/reseller/pesanan', buyer, wrap(async (req, res) => {
  const ajuan = await prisma.resellerPengajuan.findFirst({ where: { pelanggan_id: req.session.pembeli.id, status: 'approved' }, orderBy: { dibuat_pada: 'desc' } })
  if (!ajuan) throw fail(403, 'Riwayat reseller hanya tersedia untuk reseller yang telah disetujui.')
  const rows = await prisma.pesanan.findMany({ where: { pelanggan_id: req.session.pembeli.id }, include: { item: { select: { produk_id: true, nama: true, harga: true, jumlah: true, subtotal: true }, orderBy: { id: 'asc' } } }, orderBy: [{ dibuat_pada: 'desc' }, { id: 'desc' }], take: 200 })
  return ok(res, rows.map((row) => ({ id: row.id, produk: row.produk_ringkas, kategori: row.kategori, metode: row.metode, subtotal: Number(row.subtotal), biayaLayanan: Number(row.biaya_layanan), potongan: Number(row.potongan), total: Number(row.total), status: row.status, catatan: row.catatan, dibuatPada: row.dibuat_pada, diperbaruiPada: row.diperbarui_pada, item: row.item.map((item) => ({ produkId: item.produk_id, nama: item.nama, harga: Number(item.harga), jumlah: item.jumlah, subtotal: Number(item.subtotal) })) })))
}))
app.get('/api/reseller/:id', admin, role('superadmin'), wrap(async (req, res) => { const row = await prisma.resellerPengajuan.findUnique({ where: { id: req.params.id } }); if (!row) throw fail(404, 'Pengajuan reseller tidak ditemukan.'); return ok(res, row) }))
app.post('/api/reseller', buyer, resellerApplicationLimiter, csrf, wrap(async (req, res) => {
  const customer = await prisma.pelanggan.findUnique({ where: { id: req.session.pembeli.id } }); if (!customer || customer.status !== 'Aktif') throw fail(401, 'Perlu masuk terlebih dahulu.')
  const existing = await prisma.resellerPengajuan.findFirst({ where: { pelanggan_id: customer.id, status: { in: ['pending', 'approved'] } } }); if (existing) throw fail(409, 'Pengajuan reseller aktif sudah ada.')
  const input = body(req), whatsapp = str(input.whatsapp, 40)
  if (!/^\+?[0-9]{8,20}$/.test(whatsapp)) throw fail(422, whatsapp ? 'Nomor WhatsApp tidak valid.' : 'Nomor WhatsApp wajib diisi.')
  const row = await prisma.resellerPengajuan.create({ data: { id: id('res'), pelanggan_id: customer.id, nama: customer.nama, email: customer.email, username: customer.username, whatsapp, catatan: str(input.catatan, 500), status: 'pending' } })
  return ok(res, row, 'Pengajuan reseller dikirim.', 201)
}))
app.put('/api/reseller/:id/status', admin, role('superadmin'), csrf, wrap(async (req, res) => {
  const input = body(req), status = str(input.status, 20).toLowerCase(), alasan = str(input.alasan_penolakan ?? input.alasanPenolakan, 500)
  if (!['approved', 'rejected'].includes(status)) throw fail(422, 'Status tidak valid. Pakai approved atau rejected.')
  if (status === 'rejected' && !alasan) throw fail(422, 'Alasan penolakan wajib diisi.')
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.resellerPengajuan.findUnique({ where: { id: req.params.id } })
    if (!current) throw fail(404, 'Pengajuan reseller tidak ditemukan.')
    const updated = await tx.resellerPengajuan.update({ where: { id: req.params.id }, data: { status, admin_id: req.session.admin.id, alasan_penolakan: status === 'rejected' ? alasan : '', diperbarui_pada: new Date() } })
    await tx.aktivitas.create({ data: { teks: `Status reseller diubah ${current.status} -> ${status}`, ikon: status === 'approved' ? 'centangLingkaran' : 'silangLingkaran', warna: status === 'approved' ? 'hijau' : 'merah', admin_pengguna: req.session.admin.pengguna } })
    return updated
  })
  return ok(res, row, 'Status reseller diperbarui.')
}))
app.post('/api/reseller/:id/batal', buyer, csrf, wrap(async (req, res) => {
  const row = await prisma.resellerPengajuan.findFirst({ where: { id: req.params.id, pelanggan_id: req.session.pembeli.id } }); if (!row) throw fail(404, 'Pengajuan reseller tidak ditemukan.')
  if (row.status !== 'pending') throw fail(409, 'Pengajuan yang sudah diproses tidak dapat dibatalkan.')
  await prisma.resellerPengajuan.delete({ where: { id: row.id } }); return ok(res, { id: row.id }, 'Pengajuan dibatalkan.')
}))

function identity(req) {
  if (req.session.admin) return { tipe: 'admin', id: String(req.session.admin.id), nama: req.session.admin.nama || req.session.admin.pengguna }
  if (req.session.pembeli) return { tipe: 'pembeli', id: String(req.session.pembeli.id), nama: req.session.pembeli.nama }
  throw fail(401, 'Perlu masuk terlebih dahulu.')
}
async function ensureMember(conversationId, who) {
  const conversation = await prisma.percakapan.findUnique({ where: { id: conversationId } })
  if (!conversation) throw fail(404, 'Percakapan tidak ditemukan.')
  if (who.tipe === 'admin') return conversation
  const member = await prisma.anggotaPercakapan.findFirst({ where: { percakapan_id: conversationId, user_tipe: who.tipe, user_id: who.id, keluar_pada: null } })
  if (!member) throw fail(403, 'Anda bukan anggota percakapan ini.')
  return conversation
}
async function conversationSummary(conversation) {
  const last = await prisma.pesan.findFirst({ where: { percakapan_id: conversation.id, dihapus_pada: null }, orderBy: [{ dibuat_pada: 'desc' }, { id: 'desc' }], select: { teks: true } })
  return { ...conversation, pesan_terakhir: last?.teks || null }
}
app.get('/api/pesan/percakapan', activeIdentity, wrap(async (req, res) => {
  const who = identity(req), where = who.tipe === 'admin' ? (req.query.status ? { status: str(req.query.status, 40) } : {}) : { anggota: { some: { user_tipe: who.tipe, user_id: who.id, keluar_pada: null } } }
  const rows = await prisma.percakapan.findMany({ where, orderBy: [{ diperbarui_pada: 'desc' }, { dibuat_pada: 'desc' }], take: 200 })
  return ok(res, await Promise.all(rows.map(conversationSummary)))
}))
app.post('/api/pesan/percakapan', activeIdentity, csrf, wrap(async (req, res) => {
  const who = identity(req), input = body(req), type = ['penjualan', 'cs'].includes(input.tipe) ? input.tipe : 'penjualan'
  const customerId = who.tipe === 'pembeli' ? who.id : str(input.pelangganId, 40) || null
  const productId = str(input.produkId, 40) || null, orderId = str(input.pesananId, 40) || null
  if (who.tipe === 'admin' && customerId && !await prisma.pelanggan.findUnique({ where: { id: customerId } })) throw fail(404, 'Pelanggan tidak ditemukan.')
  if (who.tipe === 'pembeli' && orderId) { const order = await prisma.pesanan.findFirst({ where: { id: orderId, pelanggan_id: who.id } }); if (!order) throw fail(404, 'Pesanan tidak ditemukan.') }
  if (productId && !await prisma.produk.findUnique({ where: { id: productId } })) throw fail(404, 'Produk tidak ditemukan.')
  const dedup = productId && customerId ? `${type}:${customerId}:${productId}`.slice(0, 100) : null
  let existing = orderId ? await prisma.percakapan.findUnique({ where: { pesanan_id: orderId } }) : null
  if (!existing && dedup) existing = await prisma.percakapan.findUnique({ where: { kunci_dedup: dedup } })
  if (existing) { await ensureMember(existing.id, who); return ok(res, await conversationSummary(existing)) }
  const csId = who.tipe === 'admin' ? Number(input.csPetugasId || who.id) : null
  if (csId && !await prisma.admin.findUnique({ where: { id: csId } })) throw fail(404, 'Petugas tidak ditemukan.')
  const result = await prisma.$transaction(async (tx) => {
    const conv = await tx.percakapan.create({ data: { id: id('cak'), tipe: type, judul: str(input.judul, 200), status: 'open', pelanggan_id: customerId, creator_id: str(input.creatorId, 40) || null, produk_id: productId, pesanan_id: orderId, cs_petugas_id: csId, kunci_dedup: dedup } })
    await tx.anggotaPercakapan.create({ data: { id: id('agt'), percakapan_id: conv.id, user_tipe: who.tipe, user_id: who.id, peran: 'pemilik' } })
    if (csId && !(who.tipe === 'admin' && String(csId) === who.id)) await tx.anggotaPercakapan.create({ data: { id: id('agt'), percakapan_id: conv.id, user_tipe: 'admin', user_id: String(csId), peran: 'petugas' } })
    return conv
  })
  return ok(res, await conversationSummary(result), '', 201)
}))
app.get('/api/pesan/percakapan/:id', activeIdentity, wrap(async (req, res) => {
  const who = identity(req); await ensureMember(req.params.id, who)
  const row = await prisma.percakapan.findUnique({ where: { id: req.params.id } })
  const limit = Math.max(1, Math.min(200, Number(req.query.batas) || 50))
  const [messages, members] = await Promise.all([
    prisma.pesan.findMany({ where: { percakapan_id: row.id, dihapus_pada: null }, orderBy: [{ dibuat_pada: 'desc' }, { id: 'desc' }], take: limit }),
    prisma.anggotaPercakapan.findMany({ where: { percakapan_id: row.id, keluar_pada: null }, select: { user_tipe: true, user_id: true, peran: true, terakhir_baca_pada: true } }),
  ])
  return ok(res, { ...(await conversationSummary(row)), pesan: messages.reverse(), anggota: members })
}))
app.put('/api/pesan/percakapan/:id', admin, csrf, wrap(async (req, res) => {
  const status = str(body(req).status, 40); if (!['open', 'in_progress', 'closed'].includes(status)) throw fail(422, 'Status percakapan tidak valid.')
  const row = await prisma.percakapan.update({ where: { id: req.params.id }, data: { status, diperbarui_pada: new Date() } }); return ok(res, { id: row.id, status: row.status }, 'Status percakapan diperbarui.')
}))
app.post('/api/pesan/percakapan/:id', activeIdentity, csrf, wrap(async (req, res) => {
  const who = identity(req); const conv = await ensureMember(req.params.id, who)
  if (conv.status === 'closed') throw fail(409, 'Percakapan sudah ditutup.')
  const text = str(body(req).teks, 4000); if (!text) throw fail(422, 'Pesan masih kosong.')
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.pesan.create({ data: { id: id('msg'), percakapan_id: conv.id, pengirim_tipe: who.tipe, pengirim_id: who.id, teks: text, tipe: 'teks' } })
    await tx.percakapan.update({ where: { id: conv.id }, data: { pesan_terakhir_id: row.id, diperbarui_pada: new Date() } })
    await tx.pesanBaca.create({ data: { pesan_id: row.id, user_tipe: who.tipe, user_id: who.id } })
    return row
  })
  return ok(res, result, 'Pesan terkirim.', 201)
}))
app.post('/api/pesan/baca', activeIdentity, csrf, wrap(async (req, res) => {
  const who = identity(req), conversationId = str(body(req).percakapanId, 40); if (!conversationId) throw fail(400, 'percakapanId wajib diisi.')
  await ensureMember(conversationId, who)
  const unread = await prisma.pesan.findMany({ where: { percakapan_id: conversationId, dihapus_pada: null }, select: { id: true } })
  if (unread.length) await prisma.pesanBaca.createMany({ data: unread.map((message) => ({ pesan_id: message.id, user_tipe: who.tipe, user_id: who.id })), skipDuplicates: true })
  await prisma.anggotaPercakapan.updateMany({ where: { percakapan_id: conversationId, user_tipe: who.tipe, user_id: who.id }, data: { terakhir_baca_pada: new Date() } })
  return ok(res, { percakapanId: conversationId }, 'Ditandai sudah dibaca.')
}))
app.delete('/api/pesan/:id', activeIdentity, csrf, wrap(async (req, res) => {
  const who = identity(req), message = await prisma.pesan.findUnique({ where: { id: req.params.id } }); if (!message) throw fail(404, 'Pesan tidak ditemukan.')
  if (who.tipe !== 'admin' && !(message.pengirim_tipe === who.tipe && message.pengirim_id === who.id)) throw fail(403, 'Tidak berhak menghapus pesan ini.')
  await prisma.pesan.update({ where: { id: message.id }, data: { dihapus_pada: new Date() } }); return ok(res, { id: message.id }, 'Pesan dihapus.')
}))

app.post('/api/chat', chatLimiter, wrap(async (req, res) => {
  const input = body(req), message = str(input.pesan, 2000)
  if (!message) throw fail(422, 'Pesan masih kosong.')
  const endpoint = str(process.env.GAMEKU_CHAT_ENDPOINT, 500), key = process.env.GAMEKU_CHAT_API_KEY || ''
  if (!endpoint || !key) throw fail(503, 'Asisten AI belum dikonfigurasi di server.')
  if (!/^https:\/\//i.test(endpoint)) throw fail(500, 'Konfigurasi asisten AI tidak valid.')
  const history = (Array.isArray(input.riwayat) ? input.riwayat : []).slice(-10).map((item) => ({ role: item?.peran === 'asisten' ? 'assistant' : 'user', content: str(item?.isi, 2000) })).filter((item) => item.content)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ model: str(process.env.GAMEKU_CHAT_MODEL || 'gpt-4o-mini', 100), messages: [{ role: 'system', content: 'Kamu asisten Gamesku (marketplace item Minecraft + katalog anime Streamku). Jawab singkat dalam Bahasa Indonesia. Jangan mengarang produk, harga, stok, atau episode. Bila tidak tahu, arahkan ke Store, Streamku, atau Bantuan.' }, ...history, { role: 'user', content: message }], max_tokens: 500, temperature: 0.7 }), signal: controller.signal })
    if (!response.ok) { console.error('[gameku-chat] Provider returned HTTP', response.status); throw fail(502, 'Asisten AI sedang sibuk. Coba lagi nanti.') }
    const data = await response.json(), answer = data?.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) throw fail(502, 'Asisten AI sedang sibuk. Coba lagi nanti.')
    return ok(res, { balasan: answer.trim().slice(0, 4000) })
  } catch (error) {
    if (error.status) throw error
    console.error('[gameku-chat] Provider request failed:', error.name)
    throw fail(502, 'Asisten AI sedang sibuk. Coba lagi nanti.')
  } finally { clearTimeout(timer) }
}))

let animeCache = null
function loadAnime() {
  if (!animeCache) {
    const file = path.resolve(cwd, '../api/data_anime_lengkap.json')
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(data.anime)) throw new Error('Format katalog anime tidak valid.')
    animeCache = data
  }
  return animeCache
}
const animeSummary = (series) => ({ idKategori: series.id_kategori ?? null, judul: String(series.judul || ''), slug: String(series.slug || ''), gambar: String(series.gambar || ''), jumlahEpisode: Number(series.eps_terhitung ?? series.eps?.length ?? 0), totalEpisode: Number(series.total_eps ?? series.eps?.length ?? 0) })
const animeEpisode = (episode) => ({ no: Number(episode.no || 0), judul: String(episode.judul || ''), tanggal: episode.tanggal || null, link: String(episode.link || '') })
const streamCache = new Map()
const safeHttps = (input) => {
  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || !host || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /^\[?[:0-9a-f]+\]?$/i.test(host)) return null
    return url
  } catch { return null }
}
async function getUpstreamText(input, referer = null, method = 'GET', payload = null) {
  let current = safeHttps(input); if (!current) return null
  for (let redirects = 0; redirects <= 3; redirects++) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(current, { method, redirect: 'manual', signal: controller.signal, headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: method === 'POST' ? '*/*' : 'text/html,*/*;q=0.8', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        ...(referer && safeHttps(referer) ? { Referer: referer } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://otakudesu.com.mx' } : {}),
      }, ...(payload ? { body: payload } : {}) })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); if (!location) return null
        current = safeHttps(new URL(location, current).href); if (!current) return null
        method = 'GET'; payload = null; continue
      }
      if (!response.ok) return null
      const text = await response.text(); return text.length <= 2_000_000 ? text : null
    } catch { return null } finally { clearTimeout(timer) }
  }
  return null
}
function iframeFrom(html) { const match = html.match(/<iframe[^>]*?src=["'](https:\/\/[^"']+)["']/i); return match && safeHttps(match[1]) ? match[1].trim() : null }
async function resolvePlayback(slug, no, link) {
  const key = `streamku:${slug}:${no}`, cached = streamCache.get(key)
  if (cached && cached.until > Date.now()) return cached.data
  const data = { sumberPemutaran: 'belum-tersedia', urlPemutaran: null, embedPemutaran: null, diperiksaPada: new Date().toISOString() }
  if (!safeHttps(link)) return data
  try {
    const page = await getUpstreamText(link)
    if (page) {
      const start = ['megavid', 'video-content'].map((term) => page.indexOf(term)).find((position) => position >= 0)
      let embed = start !== undefined ? iframeFrom(page.slice(Math.max(0, start - 2000), Math.max(0, start - 2000) + 12000)) : null
      if (!embed) {
        const option = page.match(/<option\s+value=["']([A-Za-z0-9+/=]{40,})["']/i), decoded = option ? Buffer.from(option[1], 'base64').toString() : ''
        const hash = decoded.match(/data-video=["']([A-Za-z0-9_-]{4,32})["']/i)?.[1]
        const origin = new URL(link)
        if (hash && (origin.hostname === 'otakudesu.com.mx' || origin.hostname.endsWith('.otakudesu.com.mx'))) {
          const ajax = await getUpstreamText(`${origin.origin}/wp-admin/admin-ajax.php`, link, 'POST', new URLSearchParams({ action: 'as_load_player', hash }).toString())
          embed = ajax ? iframeFrom(ajax) : null
        }
      }
      if (embed) {
        const embedded = await getUpstreamText(embed, link) || await getUpstreamText(embed)
        const media = embedded?.match(/(https:\/\/[^\s"'\\]+?\.(m3u8|mp4)(?:\?[^\s"'\\]*)?)/i)
        if (media && safeHttps(media[1])) { data.sumberPemutaran = media[2].toLowerCase() === 'm3u8' ? 'hls' : 'mp4'; data.urlPemutaran = media[1] }
        else { data.sumberPemutaran = 'embed'; data.embedPemutaran = embed }
      }
    }
  } catch (error) { console.error('[gameku-streamku] upstream lookup failed:', error.name) }
  streamCache.set(key, { data, until: Date.now() + 6 * 60 * 60 * 1000 })
  return data
}
app.get('/api/anime', wrap(async (req, res) => {
  const source = loadAnime(), query = str(req.query.q, 100).toLowerCase()
  const all = source.anime.filter((item) => !query || `${item.judul || ''} ${item.slug || ''}`.toLowerCase().includes(query))
  const per = Math.max(1, Math.min(48, Number(req.query.per) || 24)), pages = Math.max(1, Math.ceil(all.length / per)), page = Math.min(pages, Math.max(1, Number(req.query.halaman) || 1))
  return ok(res, { items: all.slice((page - 1) * per, page * per).map(animeSummary), halaman: page, per, total: all.length, totalHalaman: pages, kueri: query, sumber: source.sumber || null, diambilPada: source.diambil_pada || null })
}))
app.get('/api/anime/:slug/episode/:no', wrap(async (req, res) => {
  const series = loadAnime().anime.find((item) => item.slug === req.params.slug); if (!series) throw fail(404, 'Seri anime tidak ditemukan.')
  const episodeNo = Number(req.params.no); if (!Number.isInteger(episodeNo) || episodeNo < 1) throw fail(400, 'Nomor episode tidak valid.')
  const episode = series.eps?.find((item) => Number(item.no) === episodeNo); if (!episode) throw fail(404, 'Episode tidak ditemukan.')
  return ok(res, { seri: { judul: series.judul || '', slug: series.slug }, episode: { ...animeEpisode(episode), ...await resolvePlayback(series.slug, episodeNo, episode.link || '') } })
}))
app.get('/api/anime/:slug', wrap(async (req, res) => {
  const series = loadAnime().anime.find((item) => item.slug === req.params.slug); if (!series) throw fail(404, 'Seri anime tidak ditemukan.')
  const episodes = (series.eps || []).map(animeEpisode).sort((a, b) => a.no - b.no)
  return ok(res, { seri: animeSummary(series), episode: episodes })
}))

// Read-only public catalogue. Public callers never see Draft/Nonaktif records.
app.get('/api/kategori', wrap(async (req, res) => ok(res, await prisma.kategori.findMany({ where: req.session.admin ? {} : { status: 'Aktif' }, orderBy: { nama: 'asc' } }))))
app.get('/api/kategori/:id', wrap(async (req, res) => { const row = await prisma.kategori.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }], ...(req.session.admin ? {} : { status: 'Aktif' }) } }); if (!row) throw fail(404, 'Kategori tidak ditemukan.'); return ok(res, row) }))
app.get('/api/produk', wrap(async (req, res) => {
  const where = req.session.admin ? {} : { status: 'Aktif' }
  if (req.query.kategori) where.kategori_id = String(req.query.kategori)
  if (req.query.jenis) where.jenis = String(req.query.jenis)
  if (req.query.cari) where.OR = ['nama', 'creator', 'slug'].map((field) => ({ [field]: { contains: String(req.query.cari), mode: 'insensitive' } }))
  return ok(res, await prisma.produk.findMany({ where, orderBy: { dibuat_pada: 'desc' }, take: 500 }))
}))
app.get('/api/produk/:id', wrap(async (req, res) => { const row = await prisma.produk.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }], ...(req.session.admin ? {} : { status: 'Aktif' }) } }); if (!row) throw fail(404, 'Produk tidak ditemukan.'); return ok(res, row) }))
app.get('/api/promo/cek', wrap(async (req, res) => {
  const today = new Date(); const code = str(req.query.kode, 40).toUpperCase()
  const promo = await prisma.promo.findFirst({ where: { kode: code, status: 'Aktif', AND: [{ OR: [{ mulai: null }, { mulai: { lte: today } }] }, { OR: [{ berakhir: null }, { berakhir: { gte: today } }] }] } })
  return ok(res, promo && promo.terpakai < promo.batas ? promo : null, promo ? '' : 'Kode promo tidak berlaku.')
}))
app.get('/api/promo', wrap(async (req, res) => ok(res, await prisma.promo.findMany({ where: req.session.admin ? {} : { status: 'Aktif' }, orderBy: { dibuat_pada: 'desc' } }))))
app.get('/api/ulasan/produk/:produkId', wrap(async (req, res) => { const rows = await prisma.ulasan.findMany({ where: { produk_id: req.params.produkId, status: 'Disetujui' }, orderBy: { tanggal: 'desc' } }); const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / rows.length * 10) / 10 : null; return ok(res, { ulasan: rows.map((row) => ({ ...row, produkId: row.produk_id, produk: row.produk_nama, pelangganId: row.pelanggan_id, pelanggan: row.pelanggan_nama })), rataRating: average, jumlah: rows.length }) }))

// Checkout: server-side price lookup, capped quantities, promo quota update and items in one transaction.
app.post('/api/pesanan', csrf, wrap(async (req, res) => {
  const input = body(req), items = Array.isArray(input.item) ? input.item : []
  if (!items.length || items.length > 40) throw fail(422, 'Keranjang kosong atau jumlah item tidak valid.')
  const key = str(input.idempotencyKey, 64)
  if (key && !/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw fail(400, 'Kunci idempotensi tidak valid.')
  if (key) { const old = await prisma.pesanan.findUnique({ where: { idempotency_key: key } }); if (old) return ok(res, { id: old.id, subtotal: num(old.subtotal), biayaLayanan: num(old.biaya_layanan), potongan: num(old.potongan), total: num(old.total), status: old.status }, 'Pesanan sudah tercatat.') }
  const rows = []
  for (const inputItem of items) {
    const productId = str(inputItem?.produkId, 40), qty = Math.min(10, Math.max(1, Math.round(Number(inputItem?.jumlah) || 1)))
    if (!productId) throw fail(422, 'Item keranjang tidak valid: produkId wajib diisi.')
    const product = await prisma.produk.findUnique({ where: { id: productId } })
    if (!product || product.status !== 'Aktif') throw fail(422, 'Salah satu produk tidak tersedia untuk dibeli.')
    rows.push({ produk_id: product.id, nama: product.nama, harga: product.harga, jumlah: qty, subtotal: product.harga * BigInt(qty), kategori_id: product.kategori_id })
  }
  const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0n)
  const promoCode = str(input.kodePromo, 40).toUpperCase()
  const fee = 1000n
  const promo = promoCode ? await prisma.promo.findFirst({ where: { kode: promoCode, status: 'Aktif', AND: [{ OR: [{ mulai: null }, { mulai: { lte: new Date() } }] }, { OR: [{ berakhir: null }, { berakhir: { gte: new Date() } }] }] } }) : null
  const discount = promo && promo.terpakai < promo.batas ? (promo.diskon === 0 ? fee : (subtotal * BigInt(promo.diskon) + 50n) / 100n < 50000n ? (subtotal * BigInt(promo.diskon) + 50n) / 100n : 50000n) : 0n
  const total = subtotal + fee > discount ? subtotal + fee - discount : 0n
  const buyerData = input.pembeli || {}
  const email = str(buyerData.email, 150).toLowerCase()
  const customerName = str(buyerData.nama || input.nama, 120)
  const category = rows.find((row) => row.kategori_id)?.kategori_id
  const categoryRow = category ? await prisma.kategori.findUnique({ where: { id: category } }) : null
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2), mm = String(now.getMonth() + 1).padStart(2, '0')
  let orderId
  do { orderId = `GK-${yy}${mm}-${crypto.randomInt(1000, 10000)}` } while (await prisma.pesanan.findUnique({ where: { id: orderId } }))
  const order = await prisma.$transaction(async (tx) => {
    let customerId = req.session.pembeli?.id || null
    if (email && !customerId) {
      const prior = await tx.pelanggan.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
      if (prior) customerId = prior.id
      else { customerId = id('pel'); await tx.pelanggan.create({ data: { id: customerId, nama: customerName, email } }) }
    }
    if (promo && discount > 0n) {
      const claimed = await tx.promo.updateMany({ where: { id: promo.id, terpakai: { lt: promo.batas } }, data: { terpakai: { increment: 1 } } })
      if (claimed.count !== 1) throw fail(409, 'Kuota kode promo sudah habis. Silakan tanpa kode promo.')
    }
    const created = await tx.pesanan.create({ data: {
      id: orderId, pelanggan_id: customerId, pelanggan_nama: customerName, email,
      whatsapp: str(buyerData.whatsapp, 40), produk_ringkas: str([...new Set(rows.map((r) => r.nama))].join(', '), 255),
      kategori: categoryRow?.nama || '', metode: str(input.metode, 60), subtotal, biaya_layanan: fee, potongan: discount,
      total, kode_promo: promo && discount > 0n ? promoCode : '', idempotency_key: key || null,
      item: { create: rows.map(({ produk_id, nama, harga, jumlah, subtotal: itemSubtotal }) => ({ produk_id, nama, harga, jumlah, subtotal: itemSubtotal })) },
    }, include: { item: true } })
    if (customerId) await tx.pelanggan.update({ where: { id: customerId }, data: { jumlah_pesanan: { increment: 1 }, total_beli: { increment: total } } })
    return created
  })
  return ok(res, { id: order.id, subtotal: num(order.subtotal), biayaLayanan: num(order.biaya_layanan), potongan: num(order.potongan), total: num(order.total), status: order.status }, 'Pesanan dibuat.', 201)
}))

// Admin order management and payment record. Payment remains manual, as in the PHP API.
app.get('/api/pesanan', admin, wrap(async (req, res) => { const where = {}; if (req.query.status) where.status = str(req.query.status, 40); if (req.query.cari) where.OR = ['id', 'pelanggan_nama', 'email'].map((field) => ({ [field]: { contains: String(req.query.cari), mode: 'insensitive' } })); const rows = await prisma.pesanan.findMany({ where, orderBy: { dibuat_pada: 'desc' }, take: 500 }); return ok(res, safe(rows.map((r) => ({ ...r, subtotal: num(r.subtotal), biayaLayanan: num(r.biaya_layanan), potongan: num(r.potongan), total: num(r.total), pelanggan: r.pelanggan_nama, produk: r.produk_ringkas, promo: r.kode_promo, dibuatPada: r.dibuat_pada, diperbaruiPada: r.diperbarui_pada })))) }))
app.get('/api/pesanan/:id', admin, wrap(async (req, res) => { const row = await prisma.pesanan.findUnique({ where: { id: req.params.id }, include: { item: true } }); if (!row) throw fail(404, 'Pesanan tidak ditemukan.'); return ok(res, safe({ ...row, pelanggan: row.pelanggan_nama, produk: row.produk_ringkas, biayaLayanan: num(row.biaya_layanan), subtotal: num(row.subtotal), potongan: num(row.potongan), total: num(row.total), dibuatPada: row.dibuat_pada, diperbaruiPada: row.diperbarui_pada })) }))
app.put('/api/pesanan/:id', admin, csrf, wrap(async (req, res) => { const allowed = ['Menunggu', 'Diproses', 'Berhasil', 'Gagal']; const status = str(body(req).status, 40); if (!allowed.includes(status)) throw fail(422, 'Status pesanan tidak valid.'); const row = await prisma.pesanan.update({ where: { id: req.params.id }, data: { status, diperbarui_pada: new Date(), ...(status === 'Berhasil' ? { diselesaikan_pada: new Date() } : {}), ...(status === 'Gagal' ? { dibatalkan_pada: new Date() } : {}) } }); return ok(res, { id: row.id, status: row.status }, 'Status pesanan diperbarui.') }))
app.delete('/api/pesanan/:id', admin, csrf, wrap(async (req, res) => { const payment = await prisma.pembayaran.findUnique({ where: { pesanan_id: req.params.id }, select: { id: true } }); if (payment) throw fail(409, 'Pesanan memiliki data pembayaran dan tidak dapat dihapus. Hapus pembayaran lebih dulu.'); await prisma.pesanan.delete({ where: { id: req.params.id } }); return ok(res, { id: req.params.id }, 'Pesanan dihapus.') }))

const routeResources = {
  kategori: { model: 'kategori', admin: true, fields: ['nama', 'slug', 'deskripsi', 'ikon', 'gambar', 'status'], status: ['Aktif', 'Nonaktif'], required: ['nama', 'slug'] },
  produk: { model: 'produk', admin: true, fields: ['nama', 'slug', 'kategori_id', 'jenis', 'deskripsi_singkat', 'deskripsi_lengkap', 'harga', 'harga_diskon', 'thumbnail', 'preview', 'file_produk', 'versi_minecraft', 'creator', 'creator_id', 'status'], status: ['Draft', 'Aktif', 'Nonaktif'], required: ['nama', 'slug'] },
  promo: { model: 'promo', admin: true, fields: ['kode', 'nama', 'diskon', 'mulai', 'berakhir', 'batas', 'terpakai', 'status'], status: ['Aktif', 'Terjadwal', 'Berakhir'], required: ['kode', 'nama'] },
  creator: { model: 'creator', admin: true, publicCreate: true, fields: ['nama', 'username', 'status'], status: ['Aktif', 'Review', 'Ditangguhkan'], required: ['nama'] },
  pelanggan: { model: 'pelanggan', admin: true, publicCreate: true, fields: ['nama', 'username', 'email', 'status'], status: ['Aktif', 'Nonaktif'], required: ['email'] },
  ulasan: { model: 'ulasan', admin: true, publicCreate: true, fields: ['status'], status: ['Menunggu', 'Disetujui', 'Disembunyikan'], required: [] },
}
const mapField = (resource, key) => ({ kategori_id: 'kategori_id' })[key] || key
for (const [route, config] of Object.entries(routeResources)) {
  const delegate = prisma[config.model]
  app.get(`/api/${route}`, wrap(async (req, res) => {
    if (config.admin && req.session.admin) {} else if (config.admin && ['pelanggan', 'creator', 'ulasan'].includes(route)) { if (!req.session.admin) throw fail(401, 'Perlu masuk sebagai admin.') }
    const where = route === 'produk' && !req.session.admin ? { status: 'Aktif' } : route === 'kategori' && !req.session.admin ? { status: 'Aktif' } : route === 'promo' && !req.session.admin ? { status: 'Aktif' } : {}
    if (req.query.status && req.session.admin) where.status = str(req.query.status, 40)
    if (route === 'media') return ok(res, [])
    return ok(res, await delegate.findMany({ where, orderBy: { dibuat_pada: 'desc' }, take: 500 }))
  }))
  if (['kategori', 'produk', 'promo', 'creator', 'pelanggan', 'ulasan'].includes(route)) {
    if (!['kategori', 'produk'].includes(route)) app.get(`/api/${route}/:id`, admin, wrap(async (req, res) => { const row = await delegate.findUnique({ where: { id: req.params.id } }); if (!row) throw fail(404, 'Data tidak ditemukan.'); return ok(res, safe(row)) }))
    app.post(`/api/${route}`, ...(config.admin && !config.publicCreate ? [admin] : []), ...(route === 'pelanggan' ? [(req, res, next) => req.session.admin ? next() : registrationLimiter(req, res, next)] : []), ...(route === 'ulasan' ? [reviewLimiter] : []), ...mutate, wrap(async (req, res) => {
      const input = body(req); for (const key of config.required) if (!str(input[key], 255)) throw fail(422, `${key} wajib diisi.`)
      const data = Object.fromEntries(config.fields.filter((key) => input[key] !== undefined).map((key) => [mapField(route, key), input[key]]))
      if (data.status && config.status && !config.status.includes(data.status)) throw fail(422, 'Status tidak valid.')
      if (route === 'produk') { data.id = id('prd'); data.harga = money(input.harga); data.harga_diskon = money(input.hargaDiskon ?? input.harga_diskon); if (input.kategoriId) data.kategori_id = str(input.kategoriId, 40); if (input.creatorId) data.creator_id = str(input.creatorId, 40); if (input.preview && typeof input.preview === 'string') { try { data.preview = JSON.parse(input.preview) } catch { throw fail(422, 'Format preview tidak valid.') } } }
      if (route === 'kategori') data.id = id('kat')
      if (route === 'promo') { data.id = id('pro'); data.kode = str(input.kode, 40).toUpperCase(); data.diskon = Math.max(0, Math.min(100, Number(input.diskon) || 0)); data.mulai = input.mulai ? new Date(input.mulai) : null; data.berakhir = input.berakhir ? new Date(input.berakhir) : null }
      if (route === 'creator') { data.id = id('cr'); data.status = 'Review' }
      if (route === 'pelanggan') {
        data.id = id('pel'); data.email = str(input.email, 150).toLowerCase(); data.nama = str(input.nama, 120); data.username = str(input.username, 60); data.total_beli = 0n; data.jumlah_pesanan = 0; data.status = 'Aktif'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw fail(422, 'Email pelanggan tidak valid.')
        if (input.sandi) { const password = String(input.sandi); if (password.length < 8) throw fail(422, 'Kata sandi minimal 8 karakter.'); if (Buffer.byteLength(password, 'utf8') > 72) throw fail(422, 'Kata sandi maksimal 72 karakter.'); data.sandi_hash = await bcrypt.hash(password, 12) }
      }
      if (route === 'ulasan') {
        const productId = str(input.produkId, 40), customerName = req.session.pembeli?.nama || str(input.pelanggan ?? input.pelangganNama, 120)
        if (!productId || !customerName) throw fail(422, 'Ulasan perlu produk dan nama pelanggan.')
        const product = await prisma.produk.findFirst({ where: { id: productId, status: 'Aktif' }, select: { id: true, nama: true } })
        if (!product) throw fail(422, 'Produk tidak ditemukan atau tidak tersedia.')
        data.id = id('uls'); data.produk_id = product.id; data.produk_nama = product.nama; data.pelanggan_id = req.session.pembeli?.id || null; data.pelanggan_nama = customerName; data.rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5))); data.komentar = String(input.komentar ?? '').slice(0, 5000); data.status = 'Menunggu'
      }
      const row = await delegate.create({ data })
      if (route === 'ulasan') return ok(res, { id: row.id, status: row.status }, 'Ulasan terkirim, menunggu moderasi.', 201)
      if (route === 'pelanggan' && !req.session.admin) return ok(res, { id: row.id, nama: row.nama, email: row.email }, 'Pendaftaran berhasil.', 201)
      return ok(res, safe(row), 'Data ditambahkan.', 201)
    }))
    app.put(`/api/${route}/:id`, admin, ...mutate, wrap(async (req, res) => {
      const input = body(req), data = Object.fromEntries(config.fields.filter((key) => input[key] !== undefined).map((key) => [mapField(route, key), input[key]]))
      if (input.status && config.status && !config.status.includes(input.status)) throw fail(422, 'Status tidak valid.')
      if (route === 'produk') { if (input.harga !== undefined) data.harga = money(input.harga); if (input.hargaDiskon !== undefined || input.harga_diskon !== undefined) data.harga_diskon = money(input.hargaDiskon ?? input.harga_diskon); if (input.kategoriId !== undefined) data.kategori_id = input.kategoriId || null; if (input.creatorId !== undefined) data.creator_id = input.creatorId || null; if (input.preview && typeof input.preview === 'string') { try { data.preview = JSON.parse(input.preview) } catch { throw fail(422, 'Format preview tidak valid.') } } }
      if (route === 'promo') { if (input.kode) data.kode = str(input.kode, 40).toUpperCase(); if (input.mulai !== undefined) data.mulai = input.mulai ? new Date(input.mulai) : null; if (input.berakhir !== undefined) data.berakhir = input.berakhir ? new Date(input.berakhir) : null }
      const row = await delegate.update({ where: { id: req.params.id }, data }); return ok(res, safe(row), 'Data diperbarui.')
    }))
    app.delete(`/api/${route}/:id`, admin, ...mutate, wrap(async (req, res) => { await delegate.delete({ where: { id: req.params.id } }); return ok(res, { id: req.params.id }, 'Data dihapus.') }))
  }
}

// Payment CRUD is deliberately admin-only; no third-party processor is configured in the legacy project.
app.get('/api/pembayaran', admin, wrap(async (req, res) => ok(res, await prisma.pembayaran.findMany({ where: req.query.status ? { status: str(req.query.status, 30) } : {}, orderBy: { dibuat_pada: 'desc' }, take: 500 }))))
app.get('/api/pembayaran/pesanan/:orderId', admin, wrap(async (req, res) => ok(res, await prisma.pembayaran.findUnique({ where: { pesanan_id: req.params.orderId }, include: { event: { orderBy: { id: 'asc' } } } }))))
app.get('/api/pembayaran/:id', admin, wrap(async (req, res) => { const row = await prisma.pembayaran.findUnique({ where: { id: req.params.id }, include: { event: { orderBy: { id: 'asc' } } } }); if (!row) throw fail(404, 'Pembayaran tidak ditemukan.'); return ok(res, safe(row)) }))
app.post('/api/pembayaran', admin, ...mutate, wrap(async (req, res) => { const input = body(req), order = await prisma.pesanan.findUnique({ where: { id: str(input.pesananId, 40) } }); if (!order) throw fail(404, 'Pesanan tidak ditemukan.'); const code = str(input.kodeIdempotensi, 64) || id('pay'); if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) throw fail(400, 'kodeIdempotensi tidak valid.'); const row = await prisma.$transaction(async (tx) => { const payment = await tx.pembayaran.create({ data: { id: id('pay'), pesanan_id: order.id, kode_idempotensi: code, nominal: input.nominal === undefined ? order.total : money(input.nominal), metode: str(input.metode, 60), akun_pembayaran: str(input.akunPembayaran, 255), referensi: str(input.referensi, 255) || null, transaction_id: str(input.transactionId, 120) || null, catatan: str(input.catatan, 255), status: 'Menunggu konfirmasi' } }); await tx.pembayaranEvent.create({ data: { pembayaran_id: payment.id, kode_idempotensi: code, jenis: 'dibuat', status_saat_itu: payment.status } }); return payment }); return ok(res, safe(row), 'Pembayaran dibuat.', 201) }))
app.put('/api/pembayaran/:id', admin, ...mutate, wrap(async (req, res) => { const input = body(req), statuses = ['Menunggu konfirmasi', 'Dikonfirmasi', 'Lunas', 'Gagal', 'Dikembalikan']; if (!statuses.includes(input.status)) throw fail(422, 'Status pembayaran tidak valid.'); const current = await prisma.pembayaran.findUnique({ where: { id: req.params.id } }); if (!current) throw fail(404, 'Pembayaran tidak ditemukan.'); const now = new Date(), data = { status: input.status, diperbarui_pada: now }; if (['Dikonfirmasi', 'Lunas'].includes(input.status)) { data.dikonfirmasi_pada = current.dikonfirmasi_pada || now; data.konfirmasi_admin = req.session.admin.pengguna } if (input.status === 'Gagal') data.gagal_pada = current.gagal_pada || now; if (input.status === 'Dikembalikan') { data.dikembalikan_pada = current.dikembalikan_pada || now; data.nominal_refund = money(input.nominalRefund); if (data.nominal_refund > current.nominal) throw fail(422, 'Nominal pengembalian melebihi nominal pembayaran.') } if (input.transactionId) data.transaction_id = str(input.transactionId, 120); if (input.catatan !== undefined) data.catatan = str(input.catatan, 255); const row = await prisma.$transaction(async (tx) => { const result = await tx.pembayaran.update({ where: { id: req.params.id }, data }); await tx.pembayaranEvent.create({ data: { pembayaran_id: result.id, kode_idempotensi: `${current.kode_idempotensi}-${crypto.randomBytes(4).toString('hex')}`, jenis: 'ubah_status', status_saat_itu: result.status } }); return result }); return ok(res, safe(row), 'Pembayaran diperbarui.') }))

app.get('/api/dasbor', admin, wrap(async (_req, res) => {
  const [produk, kategori, pesanan, pelanggan, creator, promo, ulasan, media, paid, orders, statusCounts, best] = await Promise.all([
    prisma.produk.count(), prisma.kategori.count(), prisma.pesanan.count(), prisma.pelanggan.count(),
    prisma.creator.count(), prisma.promo.count(), prisma.ulasan.count(), prisma.media.count(),
    prisma.pesanan.aggregate({ where: { status: 'Berhasil' }, _sum: { total: true } }),
    prisma.pesanan.findMany({ where: { status: 'Berhasil', dibuat_pada: { gte: new Date(Date.now() - 13 * 86400000) } }, select: { dibuat_pada: true, total: true } }),
    prisma.pesanan.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.pesananItem.groupBy({ by: ['produk_id', 'nama'], where: { pesanan: { status: 'Berhasil' } }, _sum: { jumlah: true, subtotal: true }, orderBy: { _sum: { jumlah: 'desc' } }, take: 5 }),
  ])
  const counts = { produk, kategori, pesanan, pelanggan, creator, promo, ulasan, media }
  const income = Number(paid._sum.total || 0n)
  const statistic = [
    { id: 'produk', judul: 'Total Produk', nilai: String(produk), ket: 'produk di katalog' },
    { id: 'pesanan', judul: 'Total Pesanan', nilai: String(pesanan), ket: 'transaksi masuk' },
    { id: 'pelanggan', judul: 'Total Pelanggan', nilai: String(pelanggan), ket: 'akun terdaftar' },
    { id: 'pendapatan', judul: 'Total Pendapatan', nilai: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(income), ket: 'dari pesanan berhasil' },
  ]
  const byDay = new Map()
  for (const order of orders) { const key = order.dibuat_pada.toISOString().slice(0, 10); byDay.set(key, (byDay.get(key) || 0) + Number(order.total)) }
  const grafik = Array.from({ length: 14 }, (_v, index) => {
    const date = new Date(); date.setDate(date.getDate() - (13 - index)); const key = date.toISOString().slice(0, 10)
    return { tanggal: key, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date), total: byDay.get(key) || 0 }
  })
  return ok(res, { statistik: statistic, ringkasan: counts, grafik, terlaris: best.map((row) => ({ produkId: row.produk_id, nama: row.nama, jumlah: row._sum.jumlah || 0, total: Number(row._sum.subtotal || 0n) })), perStatus: Object.fromEntries(['Menunggu', 'Diproses', 'Berhasil', 'Gagal'].map((name) => [name, statusCounts.find((row) => row.status === name)?._count._all || 0])) })
}))

// Large files upload directly to an S3-compatible object store. Vercel's
// transient function disk is used only for temporary reads, never as storage.
const acceptedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/zip', 'application/pdf'])
const multipartUpload = multer({ storage: production ? multer.memoryStorage() : multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 64 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, acceptedMime.has(file.mimetype)) })
const objectKey = () => `uploads/${crypto.randomUUID()}${crypto.randomBytes(2).toString('hex')}`
const objectPublicUrl = (key) => `${(process.env.S3_PUBLIC_BASE_URL || `${String(process.env.S3_ENDPOINT || '').replace(/\/+$/, '')}/${s3Bucket}`).replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
function sniffMime(buffer, mime) {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === 'image/gif') return buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (mime === 'video/mp4') return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  if (mime === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  if (mime === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'application/zip') return buffer.subarray(0, 2).toString('ascii') === 'PK'
  return false
}
function requireS3(_req, _res, next) { if (!s3) return next(fail(503, 'Penyimpanan object permanen belum dikonfigurasi.')); next() }
app.get('/api/media', admin, wrap(async (_req, res) => ok(res, await prisma.media.findMany({ where: { status: 'Aktif' }, orderBy: { dibuat_pada: 'desc' }, take: 500 }))))
app.post('/api/media/upload-url', admin, ...mutate, wrap(async (req, res) => {
  if (!s3) { if (production) throw fail(503, 'Penyimpanan object permanen belum dikonfigurasi.'); return ok(res, { directUpload: false }) }
  const input = body(req), mime = str(input.mime, 80), name = str(input.namaAsli, 200), size = Number(input.ukuran)
  if (!acceptedMime.has(mime) || !name || !Number.isSafeInteger(size) || size < 1 || size > 512 * 1024 * 1024) throw fail(422, 'Tipe atau ukuran berkas tidak valid.')
  const key = objectKey() + path.extname(name).toLowerCase().slice(0, 12)
  const command = new PutObjectCommand({ Bucket: s3Bucket, Key: key, ContentType: mime })
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
  return ok(res, { uploadUrl, objectKey: key, headers: { 'Content-Type': mime }, berlakuDetik: 300 })
}))
app.post('/api/media/complete', admin, ...mutate, requireS3, wrap(async (req, res) => {
  const input = body(req), key = str(input.objectKey, 255), name = str(input.namaAsli, 200), mime = str(input.mime, 80)
  if (!/^uploads\/[0-9a-f-]{36}[0-9a-f]{4}\.[a-z0-9]{1,12}$/i.test(key) || !acceptedMime.has(mime) || !name) throw fail(422, 'Data unggahan tidak valid.')
  const head = await s3.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: key })).catch(() => null)
  if (!head || !head.ContentLength || head.ContentLength > 512 * 1024 * 1024 || head.ContentType !== mime) throw fail(422, 'Berkas belum tersedia atau metadata tidak cocok.')
  const object = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: key, Range: 'bytes=0-15' }))
  const prefix = Buffer.from(await object.Body.transformToByteArray())
  if (!sniffMime(prefix, mime)) { await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key })); throw fail(422, 'Isi berkas tidak sesuai dengan tipe yang diizinkan.') }
  const ext = path.extname(name).toLowerCase()
  const row = await prisma.media.create({ data: { id: id('med'), owner_tipe: 'admin', owner_id: String(req.session.admin.id), nama: name, nama_asli: name, nama_simpan: key, jenis: str(input.jenis || 'Thumbnail', 30), mime, ekstensi: ext.slice(0, 20), ukuran: BigInt(head.ContentLength), status: 'Aktif', berkas: key, object_key: key, url: objectPublicUrl(key) } })
  return ok(res, row, 'Berkas diunggah.', 201)
}))
app.post('/api/media', admin, ...mutate, (req, _res, next) => { if (production) return next(fail(400, 'Gunakan alur upload-url untuk unggahan permanen.')); next() }, multipartUpload.single('berkas'), wrap(async (req, res) => {
  if (!req.file) throw fail(422, 'Berkas tidak valid atau belum dipilih.')
  const buffer = req.file.buffer || fs.readFileSync(req.file.path)
  if (!sniffMime(buffer.subarray(0, 16), req.file.mimetype)) { if (req.file.path) fs.unlinkSync(req.file.path); throw fail(422, 'Isi berkas tidak sesuai dengan tipe yang diizinkan.') }
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  const filename = req.file.filename || path.basename(req.file.path)
  const row = await prisma.media.create({ data: { id: id('med'), owner_tipe: 'admin', owner_id: String(req.session.admin.id), nama: str(req.file.originalname, 200), nama_asli: str(req.file.originalname, 200), nama_simpan: filename, jenis: str(req.body.jenis || 'Thumbnail', 30), mime: req.file.mimetype, ekstensi: path.extname(req.file.originalname).slice(0, 20), ukuran: BigInt(req.file.size), checksum, berkas: filename, url: `/uploads/${filename}` } })
  return ok(res, row, 'Berkas diunggah.', 201)
}))
app.delete('/api/media/:id', admin, ...mutate, wrap(async (req, res) => { const row = await prisma.media.findUnique({ where: { id: req.params.id } }); if (!row) throw fail(404, 'Media tidak ditemukan.'); if (row.object_key && s3) await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: row.object_key })); await prisma.media.update({ where: { id: row.id }, data: { status: 'Hapus', dihapus_pada: new Date() } }); return ok(res, { id: req.params.id }, 'Media dihapus.') }))

const buildDir = path.resolve(cwd, '../../build')
const hasBuild = fs.existsSync(path.join(buildDir, 'index.html'))

app.use('/uploads', express.static(uploadDir, { fallthrough: false, dotfiles: 'deny', index: false }))
if (hasBuild) app.use(express.static(buildDir, { index: false, dotfiles: 'deny' }))
app.use('/api', (_req, _res, next) => next(fail(404, 'Endpoint API tidak ditemukan.')))
if (hasBuild) app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next()
  return res.sendFile(path.join(buildDir, 'index.html'))
})
app.use((error, _req, res, _next) => {
  const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : 500)
  const message = status >= 500 ? (production ? 'Terjadi kesalahan pada server.' : error.message) : error.message
  trackThreat(_req, status >= 500 ? 'http_5xx' : 'http_4xx')
  if (status >= 500) console.error('[gameku-api]', error.code || error.name)
  return res.status(status).json({ ok: false, pesan: message })
})

export { app }
export default app
if (process.env.VERCEL !== '1' && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8000)
  app.listen(port, '0.0.0.0', () => console.log(`Gameku API listening on ${port}`))
}
