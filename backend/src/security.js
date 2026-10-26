import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const sensitiveKey = /(?:pass(?:word|wd)?|sandi|secret|token|api.?key|authorization|cookie|credential|database.?url|access.?key)/i

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redactSecrets(item)]))
}

export async function recordSecurityAudit(prisma, req, action, outcome, meta = {}) {
  const actor = req.session?.admin?.pengguna || req.session?.pembeli?.id || null
  const safeMeta = redactSecrets(meta)
  const resource = typeof safeMeta.resource === 'string' ? safeMeta.resource.slice(0, 120) : null
  return prisma.securityAuditEvent.create({ data: {
    correlation_id: `req-${crypto.randomBytes(8).toString('hex')}`,
    ts: new Date(), actor: actor ? String(actor).slice(0, 120) : null,
    action: String(action).slice(0, 120), resource,
    outcome: String(outcome).slice(0, 30), meta: safeMeta,
  } })
}

export function recordThreat(prisma, type, meta = {}) {
  return prisma.securityThreatEvent.create({ data: { type: String(type).slice(0, 50), meta: redactSecrets(meta) } })
}

const skipDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'logs', 'uploads', '.next', '.vercel'])
const scannedExtensions = new Set(['.php', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.toml'])
const credentialAssignment = /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*(['"])([^'"\r\n]{8,})\1/i

export function runSecurityScan(projectRoot, { maxFiles = 5000, maxFileBytes = 1_000_000 } = {}) {
  const findings = []
  let checked = 0
  const envFiles = []
  function walk(directory) {
    let entries
    try { entries = fs.readdirSync(directory, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if ((entry.name === '.env' || entry.name.startsWith('.env.')) && entry.name !== '.env.example') envFiles.push(path.relative(projectRoot, full).replaceAll(path.sep, '/'))
      if (entry.name.startsWith('.env') || entry.name === '.credentials.json' || entry.name === 'secrets') continue
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) walk(full)
        continue
      }
      if (!entry.isFile() || !scannedExtensions.has(path.extname(entry.name).toLowerCase()) || checked >= maxFiles) continue
      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (stat.size > maxFileBytes) continue
      checked++
      let content
      try { content = fs.readFileSync(full, 'utf8') } catch { continue }
      if (credentialAssignment.test(content)) {
        findings.push({ id: `SEC-${String(findings.length + 1).padStart(4, '0')}`, category: 'secrets', severity: 'high', component: path.relative(projectRoot, full).replaceAll(path.sep, '/'), evidence: 'Pola kredensial hardcoded terdeteksi; nilai tidak ditampilkan.', impact: 'Kredensial yang tertanam dalam kode dapat bocor.', recommendation: 'Pindahkan ke environment variable dan rotasi kredensial.', status: 'open', type: 'static_analysis' })
      }
    }
  }
  walk(projectRoot)
  for (const envFile of envFiles) findings.push({ id: `SEC-${String(findings.length + 1).padStart(4, '0')}`, category: 'secrets', severity: 'medium', component: envFile, evidence: 'File environment ada pada working tree; nilainya tidak dibaca.', impact: 'File environment dapat berisi kredensial.', recommendation: 'Pastikan file hanya lokal dan diabaikan Git.', status: 'open', type: 'static_analysis' })
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || '').split(',').map((origin) => origin.trim())
  if (allowedOrigins.includes('*')) findings.push({ id: `SEC-${String(findings.length + 1).padStart(4, '0')}`, category: 'config', severity: 'high', component: 'backend environment', evidence: 'CORS wildcard terkonfigurasi.', impact: 'Origin apa pun dapat mencoba mengakses API credentialed.', recommendation: 'Gunakan daftar origin frontend yang eksplisit.', status: 'open', type: 'static_analysis' })
  const serverFile = path.join(projectRoot, 'backend', 'src', 'server.js')
  try {
    const serverSource = fs.readFileSync(serverFile, 'utf8')
    for (const [header, pattern] of [
      ['X-Content-Type-Options', /X-Content-Type-Options/i],
      ['X-Frame-Options', /X-Frame-Options/i],
      ['Content-Security-Policy', /Content-Security-Policy/i],
    ]) {
      if (!pattern.test(serverSource)) findings.push({ id: `SEC-${String(findings.length + 1).padStart(4, '0')}`, category: 'config', severity: 'medium', component: 'backend/src/server.js', evidence: `Header ${header} tidak ditemukan pada konfigurasi API.`, impact: 'Browser kehilangan mitigasi keamanan terkait header tersebut.', recommendation: `Konfigurasikan ${header} pada semua respons API.`, status: 'open', type: 'static_analysis' })
    }
  } catch { /* This scanner may also run on a partial serverless bundle. */ }
  return { findings, filesChecked: checked }
}
