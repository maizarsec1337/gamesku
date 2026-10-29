import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/db.js'
import { redactSecrets } from '../src/security.js'

const sourceDir = path.resolve(process.env.LEGACY_SECURITY_LOG_DIR || './logs')
const auditFile = path.join(sourceDir, 'security-audit.jsonl')
const incidentFile = path.join(sourceDir, 'incidents.jsonl')
const threatFile = path.join(sourceDir, 'threat-events.jsonl')
const checkOnly = process.argv.includes('--check')
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')
const stableMeta = (value) => JSON.stringify(redactSecrets(value || {}))

function readJsonLines(file) {
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return { row: JSON.parse(line), raw: line, line: index + 1 } }
    catch { throw new Error(`Log keamanan tidak valid di ${path.basename(file)}, baris ${index + 1}; transfer dibatalkan.`) }
  })
}
function readAll() {
  const audit = readJsonLines(auditFile).map(({ row, raw, line }) => ({
    source: path.basename(auditFile), line, raw,
    data: { correlation_id: String(row.correlation_id || `req-${digest(`${path.basename(auditFile)}:${line}:${raw}`).slice(0, 16)}`).slice(0, 40), ts: new Date(row.ts), actor: row.actor == null ? null : String(row.actor).slice(0, 120), action: String(row.action || 'legacy.audit').slice(0, 120), resource: row.resource == null ? null : String(row.resource).slice(0, 120), outcome: String(row.outcome || 'unknown').slice(0, 30), meta: redactSecrets(row.meta || {}) },
  }))
  const incidents = readJsonLines(incidentFile).map(({ row, raw, line }) => ({
    source: path.basename(incidentFile), line, raw,
    data: { id: String(row.id || `INC-legacy-${digest(`${path.basename(incidentFile)}:${line}:${raw}`).slice(0, 16)}`).slice(0, 40), title: String(row.title || 'Insiden legacy').slice(0, 255), severity: String(row.severity || 'medium').slice(0, 20), status: String(row.status || 'detected').slice(0, 20), created_at: new Date(row.created_at || Date.now()), updated_at: new Date(row.updated_at || row.created_at || Date.now()), meta: redactSecrets(row.meta || {}) },
  }))
  const threats = readJsonLines(threatFile).map(({ row, raw, line }) => ({
    source: path.basename(threatFile), line, raw,
    data: { source_id: digest(`${path.basename(threatFile)}:${line}:${raw}`), ts: new Date(Number(row.ts) * 1000), type: String(row.type || 'legacy.unknown').slice(0, 50), meta: redactSecrets(row.meta || {}) },
  }))
  for (const [kind, entries] of Object.entries({ audit, incidents, threats })) {
    if (entries.some(({ data }) => !Number.isFinite((data.ts || data.created_at).getTime()))) throw new Error(`Waktu pada log ${kind} tidak valid; transfer dibatalkan.`)
  }
  return { audit, incidents, threats }
}

function normalized(value) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : typeof item === 'bigint' ? item.toString() : item)
}
async function insertOrVerify(delegate, uniqueWhere, data, label) {
  let current
  try { current = await delegate.create({ data }) }
  catch (error) {
    if (error.code !== 'P2002') throw error
    current = await delegate.findUnique({ where: uniqueWhere })
    if (!current || normalized({ ...current, id: undefined }) !== normalized({ ...data, id: undefined })) throw new Error(`Konflik data log ${label}; data yang sudah ada tidak diubah.`)
    return 'verified'
  }
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Isi DATABASE_URL di environment backend; jangan gunakan credential production untuk dry run.')
  const entries = readAll()
  const summary = [
    { table: 'security_audit_event', source: entries.audit.length, target: await prisma.securityAuditEvent.count() },
    { table: 'security_incident', source: entries.incidents.length, target: await prisma.securityIncident.count() },
    { table: 'security_threat_event', source: entries.threats.length, target: await prisma.securityThreatEvent.count({ where: { source_id: { not: null } } }) },
  ]
  console.table(summary)
  if (checkOnly) { console.log('Preflight selesai; tidak ada data yang ditulis.'); return }
  let inserted = 0, verified = 0
  for (const item of entries.audit) { const result = await insertOrVerify(prisma.securityAuditEvent, { correlation_id: item.data.correlation_id }, item.data, `${item.source}:${item.line}`); result === 'inserted' ? inserted++ : verified++ }
  for (const item of entries.incidents) { const result = await insertOrVerify(prisma.securityIncident, { id: item.data.id }, item.data, `${item.source}:${item.line}`); result === 'inserted' ? inserted++ : verified++ }
  for (const item of entries.threats) { const result = await insertOrVerify(prisma.securityThreatEvent, { source_id: item.data.source_id }, item.data, `${item.source}:${item.line}`); result === 'inserted' ? inserted++ : verified++ }
  const final = [
    { table: 'security_audit_event', source: entries.audit.length, target: await prisma.securityAuditEvent.count() },
    { table: 'security_incident', source: entries.incidents.length, target: await prisma.securityIncident.count() },
    { table: 'security_threat_event', source: entries.threats.length, target: await prisma.securityThreatEvent.count({ where: { source_id: { not: null } } }) },
  ]
  if (final.some((row) => row.target < row.source)) throw new Error('Verifikasi jumlah log keamanan gagal.')
  console.log(`Log keamanan: ${inserted} ditambahkan, ${verified} cocok diverifikasi; file sumber tidak dihapus.`)
}

main().catch((error) => { console.error(`Transfer log keamanan dibatalkan: ${error.message}`); process.exitCode = 1 }).finally(() => prisma.$disconnect())
