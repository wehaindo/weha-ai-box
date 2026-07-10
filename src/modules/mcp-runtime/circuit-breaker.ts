type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitConfig {
  failureThreshold: number
  cooldownMs: number
  halfOpenMaxRequests: number
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private lastFailureTime = 0
  private halfOpenRequests = 0
  private config: CircuitConfig = {
    failureThreshold: 5,
    cooldownMs: 30000,
    halfOpenMaxRequests: 3,
  }

  configure(config: Partial<CircuitConfig>) {
    this.config = { ...this.config, ...config }
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.config.cooldownMs) {
      this.state = 'HALF_OPEN'
      this.halfOpenRequests = 0
    }
    return this.state
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState()

    if (currentState === 'OPEN') {
      throw new Error('Circuit breaker is OPEN. Service unavailable.')
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        throw new Error('Circuit breaker is HALF_OPEN. Too many test requests.')
      }
      this.halfOpenRequests++
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.state = 'CLOSED'
    this.failures = 0
    this.halfOpenRequests = 0
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
      console.warn(`Circuit breaker OPEN after ${this.failures} failures`)
    }
  }

  reset() {
    this.state = 'CLOSED'
    this.failures = 0
    this.halfOpenRequests = 0
  }
}

export { CircuitBreaker }
export type { CircuitConfig }
