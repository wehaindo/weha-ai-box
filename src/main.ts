import { env } from './config/env.js'
import { buildApp } from './app.js'
import { databaseService } from './modules/database/database.service.js'
import { registerCoreNodes } from './modules/graph-engine/index.js'
import { schedulerService } from './modules/scheduler/index.js'
import { mcpRuntimeService } from './modules/mcp-runtime/index.js'
import { notificationGateway } from './modules/notification-gateway/notification-gateway.service.js'
import { whotifProvider, telegramProvider, emailProvider, firebaseProvider, smsProvider } from './modules/notification-gateway/providers/index.js'
import { syncEngineService, licenseService } from './modules/sync-engine/index.js'
import { erpAuthService } from './modules/erp-connector/erp-auth.service.js'

async function main() {
  console.log('Starting WEHA AI Box Runtime...')

  await databaseService.connect()

  // Load persisted ERP credentials
  await erpAuthService.loadFromDatabase()

  registerCoreNodes()
  schedulerService.start()

  notificationGateway.registerProvider(whotifProvider)
  notificationGateway.registerProvider(telegramProvider)
  notificationGateway.registerProvider(emailProvider)
  notificationGateway.registerProvider(firebaseProvider)
  notificationGateway.registerProvider(smsProvider)

  mcpRuntimeService.loadServers().catch((err) => console.warn('MCP server loading skipped:', err.message))
  syncEngineService.configure('1.0.0')
  syncEngineService.start()
  licenseService.configure()
  licenseService.start()

  const app = await buildApp()

  await app.listen({ port: env.RUNTIME_PORT, host: env.RUNTIME_HOST })
  app.log.info(`Runtime listening on http://${env.RUNTIME_HOST}:${env.RUNTIME_PORT}`)
}

main().catch((err) => {
  console.error('Failed to start runtime:', err)
  process.exit(1)
})
