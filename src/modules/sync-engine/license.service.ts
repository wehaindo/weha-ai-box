import { erpAuthService } from '../erp-connector/erp-auth.service.js'
import { databaseService } from '../database/database.service.js'

interface LicenseInfo {
  key: string
  status: 'VALID' | 'INVALID' | 'EXPIRED' | 'GRACE'
  expiresAt: string | null
  features: string[]
  maxAgents: number
  maxExecutions: number
  aiEnabled: boolean
  lastValidated: string
}

class LicenseService {
  private cachedLicense: LicenseInfo | null = null
  private validationInterval: ReturnType<typeof setInterval> | null = null

  configure() {}

  start() {
    this.validationInterval = setInterval(() => this.validate(), 3600000)
    this.validate()
    console.log('License service started (validation every 1h)')
  }

  stop() {
    if (this.validationInterval) clearInterval(this.validationInterval)
  }

  async getLicense(): Promise<LicenseInfo | null> {
    if (this.cachedLicense) return this.cachedLicense

    try {
      const db = databaseService.getClient()
      const config = await db.appConfig.findUnique({ where: { key: 'license_key' } })
      if (!config) return null

      this.cachedLicense = {
        key: config.value,
        status: 'VALID',
        expiresAt: null,
        features: ['core'],
        maxAgents: 10,
        maxExecutions: 1000,
        aiEnabled: false,
        lastValidated: new Date().toISOString(),
      }

      return this.cachedLicense
    } catch {
      return null
    }
  }

  async setLicense(key: string): Promise<{ success: boolean; message: string }> {
    try {
      const db = databaseService.getClient()

      if (erpAuthService.isConfigured()) {
        const headers = erpAuthService.getHeaders()
        const response = await fetch(`${erpAuthService.getServerUrl()}/api/license/validate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key }),
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          return { success: false, message: 'License validation failed on server' }
        }

        const result = await response.json()
        if (!result?.valid) {
          return { success: false, message: result?.error || 'Invalid license key' }
        }
      }

      await db.appConfig.upsert({
        where: { key: 'license_key' },
        update: { value: key },
        create: { key: 'license_key', value: key, encrypted: true },
      })

      this.cachedLicense = null
      return { success: true, message: 'License activated successfully' }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  }

  async validate(): Promise<boolean> {
    try {
      const license = await this.getLicense()
      if (!license) return false

      if (erpAuthService.isConfigured()) {
        const headers = erpAuthService.getHeaders()
        const response = await fetch(`${erpAuthService.getServerUrl()}/api/license/validate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: license.key }),
          signal: AbortSignal.timeout(10000),
        })

        if (response.ok) {
          const result = await response.json()
          this.cachedLicense = {
            ...license,
            status: result?.valid ? 'VALID' : 'INVALID',
            features: result?.features || license.features,
            maxAgents: result?.maxAgents || license.maxAgents,
            aiEnabled: result?.aiEnabled || false,
            lastValidated: new Date().toISOString(),
          }
          return result?.valid === true
        }
      }

      this.cachedLicense = {
        ...license,
        lastValidated: new Date().toISOString(),
      }
      return true
    } catch {
      return false
    }
  }

  async checkFeature(feature: string): Promise<boolean> {
    const license = await this.getLicense()
    if (!license) return false
    if (license.status === 'INVALID' || license.status === 'EXPIRED') return false
    if (feature === 'ai') return license.aiEnabled
    return license.features.includes(feature) || license.features.includes('*')
  }
}

export const licenseService = new LicenseService()
