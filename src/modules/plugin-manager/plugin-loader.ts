import fs from 'fs'
import path from 'path'
import type { PluginManifest } from '../../types/index.js'
import { pluginRegistry } from './plugin-registry.js'

const MANIFEST_FILE = 'manifest.json'

export async function discoverPlugins(pluginDir: string) {
  if (!fs.existsSync(pluginDir)) {
    console.warn(`Plugin directory not found: ${pluginDir}`)
    return
  }

  pluginRegistry.setPluginDir(pluginDir)

  const entries = fs.readdirSync(pluginDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const manifestPath = path.join(pluginDir, entry.name, MANIFEST_FILE)
    if (!fs.existsSync(manifestPath)) continue

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(content) as PluginManifest
      await pluginRegistry.register(manifest)
      console.log(`Discovered plugin: ${manifest.name}@${manifest.version}`)
    } catch (error) {
      console.error(`Failed to load plugin from ${entry.name}:`, error)
    }
  }
}
