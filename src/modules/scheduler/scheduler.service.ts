import { databaseService } from '../database/database.service.js'

interface ScheduledJob {
  id: string
  agentId: string
  name: string
  type: string
  cron?: string
  nextRunAt: Date | null
  config: Record<string, unknown>
}

function parseCronExpression(cron: string): number[] {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return []

  const now = new Date()
  const minute = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const dayOfMonth = now.getUTCDate()
  const month = now.getUTCMonth() + 1
  const dayOfWeek = now.getUTCDay()

  function match(value: number, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern.startsWith('*/')) {
      const step = parseInt(pattern.slice(2))
      return step > 0 && value % step === 0
    }
    if (pattern.includes(',')) {
      return pattern.split(',').map(Number).includes(value)
    }
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(Number)
      return value >= start && value <= end
    }
    return value === parseInt(pattern)
  }

  if (
    match(minute, parts[0]) &&
    match(hour, parts[1]) &&
    match(dayOfMonth, parts[2]) &&
    match(month, parts[3]) &&
    match(dayOfWeek, parts[4])
  ) {
    return [minute, hour, dayOfMonth, month, dayOfWeek]
  }

  return []
}

class SchedulerService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private running = false

  start() {
    if (this.running) return
    this.running = true

    this.intervalId = setInterval(() => this.tick(), 10000)
    console.log('Scheduler started (polling every 10s)')
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.running = false
    console.log('Scheduler stopped')
  }

  private async tick() {
    try {
      const db = databaseService.getClient()
      const now = new Date()

      const dueJobs = await db.schedule.findMany({
        where: {
          isActive: true,
          nextRunAt: { lte: now },
        },
      })

      for (const job of dueJobs) {
        await this.executeJob(job)
      }
    } catch {
      // DB not connected, skip
    }
  }

  private async executeJob(job: any) {
    try {
      console.log(`Executing scheduled job: ${job.name} (${job.id})`)

      const db = databaseService.getClient()
      await db.execution.create({
        data: {
          executionId: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          agentId: job.agentId,
          status: 'PENDING',
          trigger: 'SCHEDULED',
          input: {},
        },
      })

      const nextRun = this.calculateNextRun(job)
      await db.schedule.update({
        where: { id: job.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: nextRun,
        },
      })
    } catch (error) {
      console.error(`Failed to execute scheduled job ${job.id}:`, error)
    }
  }

  private calculateNextRun(job: any): Date | null {
    if (job.type === 'ONE_TIME') return null
    if (job.type === 'CRON' && job.cron) {
      return this.nextCronRun(job.cron)
    }
    if (job.type === 'RECURRING' && job.config?.intervalMs) {
      return new Date(Date.now() + job.config.intervalMs)
    }
    return null
  }

  private nextCronRun(cron: string): Date {
    const next = new Date(Date.now() + 60000)
    return next
  }

  async createSchedule(params: {
    agentId: string
    name: string
    type: string
    cron?: string
    startAt?: Date
    config?: Record<string, unknown>
  }) {
    const db = databaseService.getClient()
    const nextRunAt = params.type === 'CRON' && params.cron
      ? this.nextCronRun(params.cron)
      : params.startAt || null

    return await db.schedule.create({
      data: {
        agentId: params.agentId,
        name: params.name,
        type: params.type as any,
        cron: params.cron,
        startAt: params.startAt,
        nextRunAt,
        config: params.config || {},
      },
    })
  }
}

export const schedulerService = new SchedulerService()
