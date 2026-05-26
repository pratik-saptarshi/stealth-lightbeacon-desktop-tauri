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
    const reconRequest: desktop.ReconRequest = {
      target: 'https://example.com',
    }
    const snapshot: desktop.LastOpenedSnapshot = {
      evaluation: {
        evaluationId: 'eval/123',
        status: 'success',
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval/123',
        status: 'success',
        stage: 'completed',
        progressPercent: 100,
        message: 'Evaluation complete.',
        exitState: 'success',
        terminal: true,
      },
      evaluationResult: {
        evaluationId: 'eval/123',
        status: 'success',
        summary: { score: 92 },
        severityCounts: { medium: 1 },
        findings: [],
        startedAt: '2026-01-15T10:00:00Z',
        completedAt: '2026-01-15T10:00:03Z',
      },
      artifacts: [
        {
          name: 'html-report',
          kind: 'html',
          mediaType: 'text/html',
          downloadUrl: 'https://downloads.example.test/eval-123/report.html',
        },
      ],
    }

    await desktop.getBackendConfig()
    await desktop.setBackendConfig(config)
    await desktop.apiHealthCheck()
    await desktop.getCapabilities()
    await desktop.createEvaluation(request)
    await desktop.getEvaluationStatus('eval/123')
    await desktop.getEvaluationResult('eval/123')
    await desktop.getEvaluationArtifacts('eval/123')
    await desktop.runRecon(reconRequest)
    await desktop.getLastOpenedSnapshot()
    await desktop.setLastOpenedSnapshot(snapshot)

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
    expect(invoke).toHaveBeenNthCalledWith(8, 'get_evaluation_artifacts', {
      evaluationId: 'eval/123',
    })
    expect(invoke).toHaveBeenNthCalledWith(9, 'run_recon', { request: reconRequest })
    expect(invoke).toHaveBeenNthCalledWith(10, 'get_last_opened_snapshot', undefined)
    expect(invoke).toHaveBeenNthCalledWith(11, 'set_last_opened_snapshot', {
      snapshot,
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
