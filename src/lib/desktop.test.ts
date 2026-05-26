import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

import * as desktop from './desktop'

describe('desktop adapter', () => {
  beforeEach(() => {
    invoke.mockReset()
    invoke.mockResolvedValue(undefined)
  })

  it('uses the expected tauri command names and payload shapes', async () => {
    const config: desktop.BackendConfig = {
      mode: 'remote',
      baseUrl: 'https://api.example.test',
      timeoutMs: 20000,
    }
    const request: desktop.CreateEvaluationRequest = {
      target: 'https://example.com',
      profile: 'baseline',
      outputFormats: ['json'],
      maxDepth: 2,
      maxUrls: 250,
      failOnCritical: true,
      budgetGate: false,
    }

    await desktop.getBackendConfig()
    await desktop.setBackendConfig(config)
    await desktop.apiHealthCheck()
    await desktop.getCapabilities()
    await desktop.createEvaluation(request)
    await desktop.getEvaluationStatus('eval/123')
    await desktop.getEvaluationResult('eval/123')

    expect(invoke).toHaveBeenNthCalledWith(1, 'get_backend_config', undefined)
    expect(invoke).toHaveBeenNthCalledWith(2, 'set_backend_config', { config })
    expect(invoke).toHaveBeenNthCalledWith(3, 'api_health_check', undefined)
    expect(invoke).toHaveBeenNthCalledWith(4, 'get_capabilities', undefined)
    expect(invoke).toHaveBeenNthCalledWith(5, 'create_evaluation', { request })
    expect(invoke).toHaveBeenNthCalledWith(6, 'get_evaluation_status', {
      evaluationId: 'eval/123',
    })
    expect(invoke).toHaveBeenNthCalledWith(7, 'get_evaluation_result', {
      evaluationId: 'eval/123',
    })
  })

  it('formats structured command errors into a cleaner operator-facing message', () => {
    expect(
      desktop.formatCommandError({
        code: 'CAPABILITIES_UNAVAILABLE',
        message: 'Capabilities failed to load',
        status: 503,
        details: {
          endpoint: '/capabilities',
          retryable: true,
        },
      }),
    ).toBe(
      '[CAPABILITIES_UNAVAILABLE] Capabilities failed to load | HTTP 503 | endpoint: /capabilities; retryable: true',
    )
  })
})
