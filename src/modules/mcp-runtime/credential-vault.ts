import crypto from 'crypto'
import { databaseService } from '../database/database.service.js'
import { env } from '../../config/env.js'

const ALGORITHM = 'aes-256-gcm'

function deriveKey(): Buffer {
  return crypto.scryptSync(env.ENCRYPTION_KEY, 'weha-ai-box-vault-salt', 32)
}

function encrypt(text: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encryptedText: string): string {
  const key = deriveKey()
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

class CredentialVault {
  async store(name: string, value: string, metadata?: Record<string, unknown>): Promise<string> {
    const db = databaseService.getClient()
    const encrypted = encrypt(value)
    const record = await db.credentialVault.create({
      data: {
        name,
        type: 'API_KEY',
        value: encrypted,
        metadata: metadata || {},
      },
    })
    return record.id
  }

  async retrieve(id: string): Promise<string | null> {
    const db = databaseService.getClient()
    const record = await db.credentialVault.findUnique({ where: { id } })
    if (!record) return null
    return decrypt(record.value)
  }

  async retrieveByName(name: string): Promise<string | null> {
    const db = databaseService.getClient()
    const records = await db.credentialVault.findMany({
      where: { name },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    if (records.length === 0) return null
    return decrypt(records[0].value)
  }

  async delete(id: string): Promise<boolean> {
    const db = databaseService.getClient()
    try {
      await db.credentialVault.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export const credentialVault = new CredentialVault()
