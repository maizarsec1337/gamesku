import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || (process.env.NODE_ENV === 'test' ? 'postgresql://test:test@127.0.0.1:5432/test' : '')
if (!connectionString) throw new Error('DATABASE_URL is required by the backend runtime.')

// Supabase transaction pooler: keep a small, bounded per-instance pool.
const runtimeUrl = new URL(connectionString)
runtimeUrl.searchParams.delete('pgbouncer')
runtimeUrl.searchParams.delete('connection_limit')
const pool = new Pool({
  connectionString: runtimeUrl.toString(),
  max: Number(process.env.DB_POOL_MAX || 1),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  maxLifetimeSeconds: 300,
})
const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis
export const prisma = globalForPrisma.__gamekuPrisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.__gamekuPrisma = prisma
