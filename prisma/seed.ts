import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import crypto from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL || ''

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  console.log('Seeding database...')

  const admin = await prisma.user.upsert({
    where: { email: 'admin@weha.ai' },
    update: {},
    create: {
      email: 'admin@weha.ai',
      name: 'Admin',
      passwordHash: hashPassword('admin'),
      role: 'ADMIN',
    },
  })

  console.log(`Admin user created: ${admin.email}`)

  const operator = await prisma.user.upsert({
    where: { email: 'operator@weha.ai' },
    update: {},
    create: {
      email: 'operator@weha.ai',
      name: 'Operator',
      passwordHash: hashPassword('operator'),
      role: 'OPERATOR',
    },
  })

  console.log(`Operator user created: ${operator.email}`)

  const seededTools = await seedMcpTools()

  console.log(`Seeded ${seededTools.length} MCP tools: ${seededTools.map((t) => t.code).join(', ')}`)
  console.log('Seeding complete.')
}

interface McpToolSeed {
  code: string
  name: string
  description: string
  executionType: 'REPORT' | 'SERVICE' | 'HTTP' | 'SQL' | 'WORKFLOW' | 'WEBHOOK' | 'COMPOSITE' | 'SCRIPT' | 'APPROVAL'
  inputSchema: Record<string, unknown>
}

const mcpToolSeeds: McpToolSeed[] = [
  {
    code: 'inventory-stock-report',
    name: 'Get Stock Report',
    description:
      'Retrieve the current inventory stock report — stock levels, quantities on hand, and availability for products. Use for inventory or stock checks.',
    executionType: 'REPORT',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Start date (ISO) for the stock report window' },
        dateTo: { type: 'string', description: 'End date (ISO) for the stock report window' },
        sku: { type: 'string', description: 'Optional product SKU to filter the report' },
      },
    },
  },
  {
    code: 'supplier-search',
    name: 'Get Supplier',
    description:
      'Search suppliers by name or criteria and return matching supplier records. Use for supplier lookups.',
    executionType: 'SERVICE',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term matching supplier name or code' },
        limit: { type: 'integer', description: 'Maximum number of results to return' },
      },
      required: ['query'],
    },
  },
]

async function seedMcpTools() {
  const seeded: { code: string }[] = []
  for (const seed of mcpToolSeeds) {
    const existing = await prisma.mcpTool.findFirst({
      where: { code: seed.code, serverId: null },
    })
    if (existing) {
      await prisma.mcpTool.update({
        where: { id: existing.id },
        data: {
          name: seed.name,
          description: seed.description,
          executionType: seed.executionType,
          inputSchema: seed.inputSchema as any,
          status: 'ACTIVE',
        },
      })
      seeded.push({ code: existing.code || seed.code })
    } else {
      const created = await prisma.mcpTool.create({
        data: {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          executionType: seed.executionType,
          inputSchema: seed.inputSchema as any,
          status: 'ACTIVE',
          version: 1,
        },
      })
      seeded.push({ code: created.code || seed.code })
    }
  }
  return seeded
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
