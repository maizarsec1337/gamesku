import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prisma CLI migration connection; API runtime uses pooled DATABASE_URL.
  datasource: { url: env('DIRECT_URL') },
})
