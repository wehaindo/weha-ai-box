import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

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
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
