import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import pg from 'pg'
import { prisma } from '../src/db.js'

// Fixed allowlist from database/schema.sql; never accept table or column names from input.
const tables = [
  ['admin', ['id']], ['pelanggan', ['id']], ['creator', ['id']], ['kategori', ['id']], ['promo', ['id']],
  ['reseller_pengajuan', ['id']], ['produk', ['id']], ['media', ['id']], ['produk_media', ['id']],
  ['pesanan', ['id']], ['pesanan_item', ['id']], ['ulasan', ['id']], ['pembayaran', ['id']],
  ['pembayaran_event', ['id']], ['percakapan', ['id']], ['anggota_percakapan', ['id']], ['pesan', ['id']],
  ['pesan_lampiran', ['id']], ['pesan_baca', ['pesan_id', 'user_tipe', 'user_id']],
  ['riwayat_tontonan', ['id']], ['audit_log', ['id']], ['aktivitas', ['id']],
]
const relations = [
  ['reseller_pengajuan', 'pelanggan_id', 'pelanggan', 'id'], ['reseller_pengajuan', 'admin_id', 'admin', 'id'],
  ['produk', 'kategori_id', 'kategori', 'id'], ['produk', 'creator_id', 'creator', 'id'],
  ['produk_media', 'produk_id', 'produk', 'id'], ['produk_media', 'media_id', 'media', 'id'],
  ['pesanan', 'pelanggan_id', 'pelanggan', 'id'], ['pesanan_item', 'pesanan_id', 'pesanan', 'id'],
  // The legacy schema intentionally stores product names/prices on order items;
  // product_id has no FK because products can be removed after checkout.
  ['ulasan', 'produk_id', 'produk', 'id'],
  ['ulasan', 'pelanggan_id', 'pelanggan', 'id'], ['pembayaran', 'pesanan_id', 'pesanan', 'id'],
  ['pembayaran_event', 'pembayaran_id', 'pembayaran', 'id'], ['percakapan', 'pelanggan_id', 'pelanggan', 'id'],
  ['percakapan', 'creator_id', 'creator', 'id'], ['percakapan', 'produk_id', 'produk', 'id'],
  ['percakapan', 'pesanan_id', 'pesanan', 'id'], ['percakapan', 'cs_petugas_id', 'admin', 'id'],
  ['anggota_percakapan', 'percakapan_id', 'percakapan', 'id'], ['pesan', 'percakapan_id', 'percakapan', 'id'],
  ['pesan_lampiran', 'pesan_id', 'pesan', 'id'], ['pesan_lampiran', 'media_id', 'media', 'id'],
  ['pesan_baca', 'pesan_id', 'pesan', 'id'], ['riwayat_tontonan', 'pelanggan_id', 'pelanggan', 'id'],
]
const quote = (s) => `"${String(s).replaceAll('"', '""')}"`
const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const sourceUrl = process.env.LEGACY_DATABASE_URL
const checkOnly = process.argv.includes('--check')
const resume = process.argv.includes('--resume')
const batchSize = 75

async function assertConfig() {
  if (!sourceUrl || !targetUrl) throw new Error('Isi LEGACY_DATABASE_URL dan DIRECT_URL/DATABASE_URL di environment backend.')
  if (!checkOnly) {
    const backup = process.env.LEGACY_BACKUP_FILE
    const expected = String(process.env.LEGACY_BACKUP_SHA256 || '').toLowerCase()
    if (!backup || !expected) throw new Error('Transfer ditahan: siapkan dump database lama, lalu isi LEGACY_BACKUP_FILE dan LEGACY_BACKUP_SHA256.')
    const absolute = path.resolve(backup)
    if (!fs.existsSync(absolute) || fs.statSync(absolute).size === 0) throw new Error('File backup database tidak ditemukan atau kosong.')
    const digest = crypto.createHash('sha256')
    for await (const part of fs.createReadStream(absolute)) digest.update(part)
    const actual = digest.digest('hex')
    if (actual !== expected) throw new Error('SHA-256 file backup tidak cocok; transfer dibatalkan.')
  }
}

function openSource() {
  const u = new URL(sourceUrl)
  if (['postgres:', 'postgresql:'].includes(u.protocol)) {
    const pool = new pg.Pool({ connectionString: sourceUrl, ssl: u.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined, max: 2 })
    return { kind: 'pg', query: async (sql, params = []) => (await pool.query(sql, params)).rows, close: () => pool.end() }
  }
  if (u.protocol !== 'mysql:') throw new Error('LEGACY_DATABASE_URL harus memakai MySQL atau PostgreSQL.')
  process.env.TZ = process.env.LEGACY_TIMEZONE || 'Asia/Bangkok'
  const connection = awaitableMysql(sourceUrl)
  return connection
}
function awaitableMysql(url) {
  const parsed = new URL(url)
  let connection
  return {
    kind: 'mysql',
    async query(sql) { connection ||= await mysql.createConnection({ host: parsed.hostname, port: Number(parsed.port || 3306), user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), database: decodeURIComponent(parsed.pathname.slice(1)), dateStrings: true, timezone: 'local', supportBigNumbers: true, bigNumberStrings: true }); const [rows] = await connection.query(sql); return rows },
    async close() { if (connection) await connection.end() },
  }
}

async function tableCount(source, table) {
  const rows = await source.query(source.kind === 'mysql' ? `SELECT COUNT(*) AS n FROM \`${table}\`` : `SELECT COUNT(*) AS n FROM public.${quote(table)}`)
  return Number(rows[0].n)
}
async function targetCount(table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM public.${quote(table)}`)
  return Number(rows[0].n)
}
async function targetColumns(table) {
  return prisma.$queryRaw`SELECT column_name, is_generated, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`
}
async function checkRelations(source) {
  const errors = []
  for (const [table, column, parent, parentColumn] of relations) {
    const sql = source.kind === 'mysql'
      ? `SELECT COUNT(*) AS n FROM \`${table}\` c LEFT JOIN \`${parent}\` p ON c.\`${column}\`=p.\`${parentColumn}\` WHERE c.\`${column}\` IS NOT NULL AND p.\`${parentColumn}\` IS NULL`
      : `SELECT COUNT(*) AS n FROM public.${quote(table)} c LEFT JOIN public.${quote(parent)} p ON c.${quote(column)}=p.${quote(parentColumn)} WHERE c.${quote(column)} IS NOT NULL AND p.${quote(parentColumn)} IS NULL`
    const rows = await source.query(sql)
    if (Number(rows[0].n) > 0) errors.push(`${table}.${column}: ${rows[0].n} referensi yatim ke ${parent}`)
  }
  return errors
}
function normalize(value) {
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]))
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?)?$/.test(value)) {
    const iso = new Date(value.replace(' ', 'T')).toISOString()
    return iso
  }
  return value
}
function sameRow(sourceRow, targetRow, writableColumns) {
  return writableColumns.every((column) => JSON.stringify(normalize(sourceRow[column])) === JSON.stringify(normalize(targetRow[column])))
}

async function sourceRows(source, table, keys) {
  const ordering = keys.map((key) => source.kind === 'mysql' ? `\`${key}\`` : quote(key)).join(', ')
  const qualified = source.kind === 'mysql' ? `\`${table}\`` : `public.${quote(table)}`
  return source.query(`SELECT * FROM ${qualified} ORDER BY ${ordering}`)
}
async function transferTable(source, [table, keys]) {
  const targetCountBefore = await targetCount(table)
  if (targetCountBefore && !resume) throw new Error(`Tabel ${table} sudah berisi ${targetCountBefore} baris. Gunakan --resume hanya setelah preflight.`)
  const columnsMeta = await targetColumns(table)
  const targetNames = new Set(columnsMeta.map((c) => c.column_name))
  const generated = new Set(columnsMeta.filter((c) => c.is_generated === 'ALWAYS').map((c) => c.column_name))
  const columnTypes = new Map(columnsMeta.map((c) => [c.column_name, c.data_type]))
  const rows = await sourceRows(source, table, keys)
  const names = rows.length ? Object.keys(rows[0]).filter((name) => targetNames.has(name) && !generated.has(name)) : columnsMeta.map((c) => c.column_name).filter((name) => !generated.has(name))
  const prepared = (row) => Object.fromEntries(names.map((name) => {
    const value = row[name]
    if (columnTypes.get(name) === 'timestamp with time zone' && typeof value === 'string' && value !== '') return [name, new Date(value.replace(' ', 'T'))]
    return [name, value]
  }))
  for (const key of keys) if (!names.includes(key)) throw new Error(`Kunci ${table}.${key} tidak tersedia di schema source/target.`)
  const sourceNames = rows.length ? Object.keys(rows[0]) : names
  const missing = sourceNames.filter((name) => !targetNames.has(name) && !generated.has(name))
  if (missing.length) throw new Error(`Kolom sumber ${table} tidak ada di target: ${missing.join(', ')}. Jalankan migration versi yang sesuai.`)
  let inserted = 0, skipped = 0
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const values = []
    const tuples = batch.map((row, rowNo) => { const ready = prepared(row); return `(${names.map((col, columnNo) => { values.push(ready[col]); return `$${rowNo * names.length + columnNo + 1}` }).join(',')})` })
    const sql = `INSERT INTO public.${quote(table)} (${names.map(quote).join(',')}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(',')} ON CONFLICT (${keys.map(quote).join(',')}) DO NOTHING`
    inserted += await prisma.$executeRawUnsafe(sql, ...values)
  }
  {
    for (const originalRow of rows) {
      const sourceRow = prepared(originalRow)
      const where = keys.map((key, index) => `${quote(key)}=$${index + 1}`).join(' AND ')
      const targetRows = await prisma.$queryRawUnsafe(`SELECT ${names.map(quote).join(',')} FROM public.${quote(table)} WHERE ${where}`, ...keys.map((key) => sourceRow[key]))
      if (!targetRows.length) throw new Error(`Baris sumber hilang sesudah resume di tabel ${table}.`)
      if (!sameRow(sourceRow, targetRows[0], names)) throw new Error(`Konflik data ${table}: ID ${keys.map((key) => sourceRow[key]).join('/')}; tidak ada data yang ditimpa.`)
      skipped++
    }
  }
  return { source: rows.length, added: inserted, verifiedExisting: skipped, target: await targetCount(table) }
}

async function main() {
  await assertConfig()
  const source = openSource()
  try {
    const report = []
    for (const item of tables) {
      const [table] = item
      const sourceN = await tableCount(source, table)
      const targetN = await targetCount(table)
      report.push({ table, source: sourceN, target: targetN, state: targetN === 0 ? 'kosong' : 'sudah berisi' })
    }
    const orphanErrors = await checkRelations(source)
    console.table(report)
    if (orphanErrors.length) throw new Error(`Preflight menemukan relasi bermasalah: ${orphanErrors.join('; ')}`)
    if (checkOnly) {
      const occupied = report.filter((r) => r.target > 0)
      if (occupied.length) console.log('Target tidak kosong; gunakan transfer mode resume only after reviewed matching rows.')
      else console.log('Preflight lolos: target kosong, tabel sumber terpetakan, relasi tidak yatim.')
      return
    }
    if (report.some((r) => r.target > 0) && !resume) throw new Error('Target tidak kosong; jalankan pemeriksaan, lalu pilih --resume jika mengulang transfer yang konsisten.')
    for (const item of tables) console.log(item[0], await transferTable(source, item))
    for (const [table, keys] of tables) {
      if (keys.length === 1 && keys[0] === 'id') {
        const [sequence] = await prisma.$queryRawUnsafe('SELECT pg_get_serial_sequence($1, $2) AS name', `public.${table}`, 'id')
        if (sequence.name) await prisma.$queryRawUnsafe(`SELECT setval($1::regclass, COALESCE(MAX(${quote('id')}),1), MAX(${quote('id')}) IS NOT NULL) FROM public.${quote(table)}`, sequence.name)
      }
    }
    const targetOrphans = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM public."pesanan_item" i LEFT JOIN public."pesanan" p ON p.id=i.pesanan_id WHERE p.id IS NULL) q`)
    if (Number(targetOrphans[0].n) !== 0) throw new Error('Verifikasi relasi target gagal sesudah transfer.')
    for (const [table] of tables) {
      const sourceN = await tableCount(source, table), targetN = await targetCount(table)
      if (sourceN !== targetN) throw new Error(`Jumlah baris berbeda pada ${table}: source=${sourceN}, target=${targetN}`)
    }
    console.log('Transfer dan verifikasi jumlah baris selesai. Jalankan ulang perintah --check untuk audit akhir.')
  } finally { await source.close(); await prisma.$disconnect() }
}

main().catch((error) => { console.error(`Transfer dibatalkan: ${error.message}`); process.exitCode = 1 })
