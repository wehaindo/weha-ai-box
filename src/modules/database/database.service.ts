import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { env } from '../../config/env.js'

class DatabaseService {
  private client: PrismaClient | null = null
  private pool: pg.Pool | null = null

  async connect() {
    this.pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaPg(this.pool)
    this.client = new PrismaClient({ adapter })
    try {
      await this.client.$connect()
      console.log('Database connected')
    } catch (error) {
      console.error('Failed to connect to database:', error)
      throw error
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.$disconnect()
    }
    if (this.pool) {
      await this.pool.end()
    }
    console.log('Database disconnected')
  }

  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return this.client
  }

  async checkHealth(): Promise<boolean> {
    try {
      if (!this.client) return false
      await this.client.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }
}

export const databaseService = new DatabaseService()
