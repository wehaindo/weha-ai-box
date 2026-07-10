import type { PluginManifest, PluginType, PluginStatus } from '../../types/index.js'
import { databaseService } from '../database/database.service.js'

export interface PluginInstance {
  manifest: PluginManifest
  status: PluginStatus
  config: Record<string, unknown>
  start?: () => Promise<void>
  stop?: () => Promise<void>
  healthCheck?: () => Promise<boolean>
}

class PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map()
  private pluginDir: string = ''

  setPluginDir(dir: string) {
    this.pluginDir = dir
  }

  async loadFromDatabase() {
    const db = databaseService.getClient()
    const records = await db.plugin.findMany({ where: { status: 'ACTIVE' } })

    for (const record of records) {
      const manifest = record.manifest as unknown as PluginManifest
      this.plugins.set(manifest.id, {
        manifest,
        status: 'ACTIVE',
        config: (record.config as Record<string, unknown>) ?? {},
      })
    }

    console.log(`Loaded ${this.plugins.size} plugins from database`)
  }

  async register(manifest: PluginManifest) {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} already registered`)
    }

    const plugin: PluginInstance = {
      manifest,
      status: 'INSTALLED',
      config: {},
    }

    this.plugins.set(manifest.id, plugin)

    const db = databaseService.getClient()
    await db.plugin.upsert({
      where: { name: manifest.name },
      update: {
        version: manifest.version,
        manifest: manifest as unknown as Record<string, unknown>,
        status: 'INSTALLED',
      },
      create: {
        name: manifest.name,
        version: manifest.version,
        type: manifest.type as PluginType,
        manifest: manifest as unknown as Record<string, unknown>,
        status: 'INSTALLED',
        isBuiltin: false,
      },
    })

    console.log(`Plugin registered: ${manifest.name}@${manifest.version}`)
  }

  async activate(id: string) {
    const plugin = this.plugins.get(id)
    if (!plugin) throw new Error(`Plugin ${id} not found`)

    plugin.status = 'ACTIVE'

    const db = databaseService.getClient()
    await db.plugin.update({
      where: { name: plugin.manifest.name },
      data: { status: 'ACTIVE' },
    })

    console.log(`Plugin activated: ${plugin.manifest.name}`)
  }

  async deactivate(id: string) {
    const plugin = this.plugins.get(id)
    if (!plugin) throw new Error(`Plugin ${id} not found`)

    plugin.status = 'INACTIVE'

    const db = databaseService.getClient()
    await db.plugin.update({
      where: { name: plugin.manifest.name },
      data: { status: 'INACTIVE' },
    })

    console.log(`Plugin deactivated: ${plugin.manifest.name}`)
  }

  get(id: string): PluginInstance | undefined {
    return this.plugins.get(id)
  }

  list(): PluginInstance[] {
    return Array.from(this.plugins.values())
  }

  listByType(type: PluginType): PluginInstance[] {
    return this.list().filter((p) => p.manifest.type === type)
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    for (const [id, plugin] of this.plugins) {
      if (plugin.healthCheck) {
        try {
          results[id] = await plugin.healthCheck()
        } catch {
          results[id] = false
        }
      }
    }
    return results
  }
}

export const pluginRegistry = new PluginRegistry()
