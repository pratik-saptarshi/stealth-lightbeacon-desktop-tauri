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
      port: 9443,
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

  it('rejects malformed last-opened snapshots that are not terminal', async () => {
    invoke.mockResolvedValueOnce({
      evaluation: {
        evaluationId: 'eval-123',
        status: 'accepted',
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval-123',
        status: 'running',
        terminal: false,
      },
      evaluationResult: {
        evaluationId: 'eval-123',
        status: 'running',
        summary: {},
      },
      artifacts: [],
    })

    await expect(desktop.getLastOpenedSnapshot()).resolves.toBeNull()
  })

  it('rejects malformed last-opened snapshots with mismatched evaluation ids', async () => {
    invoke.mockResolvedValueOnce({
      evaluation: {
        evaluationId: 'eval-123',
        status: 'accepted',
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval-456',
        status: 'success',
        terminal: true,
      },
      evaluationResult: {
        evaluationId: 'eval-456',
        status: 'success',
        summary: {},
      },
      artifacts: [],
    })

    await expect(desktop.getLastOpenedSnapshot()).resolves.toBeNull()
  })

  it('rejects malformed last-opened snapshots with missing or blank fields', async () => {
    invoke.mockResolvedValueOnce({
      evaluation: {
        evaluationId: 'eval-123',
        status: 'accepted',
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval-123',
        status: 'success',
        terminal: true,
      },
      artifacts: [],
    })

    await expect(desktop.getLastOpenedSnapshot()).resolves.toBeNull()

    invoke.mockResolvedValueOnce({
      evaluation: {
        evaluationId: 'eval-123',
        status: null as unknown as string,
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval-123',
        status: 'success',
        terminal: true,
      },
      evaluationResult: {
        evaluationId: 'eval-123',
        status: 'success',
        summary: {},
      },
      artifacts: [],
    })

    await expect(desktop.getLastOpenedSnapshot()).resolves.toBeNull()
  })

  it('normalizes malformed recon payloads into safe defaults', async () => {
    invoke.mockResolvedValueOnce({
      target: 'https://example.com',
      recommendation: null,
      posture: 'low-risk',
      confidence: 7,
      evidence: ['signal-a', 42, null],
      evidence_summary: 'summary',
      signals: 'not-an-array',
      auto_select_allowed: 'true',
    })

    await expect(
      desktop.runRecon({ target: 'https://example.com' }),
    ).resolves.toEqual({
      target: 'https://example.com',
      recommendation: '',
      posture: 'low-risk',
      confidence: 1,
      evidence: ['signal-a'],
      evidenceSummary: 'summary',
      signals: [],
      autoSelectAllowed: true,
    })
  })

  it('detects desktop runtime from the tauri marker', () => {
    expect(desktop.isDesktopRuntime()).toBe(false)
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    expect(desktop.isDesktopRuntime()).toBe(true)
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })

  it('formats structured command errors with nested details and blank entries', () => {
    expect(
      desktop.formatCommandError({
        code: 'REMOTE_POLICY',
        message: ' Remote policy rejected the request ',
        status: 403,
        details: [
          '  ',
          ['first', { retryable: true }],
          { endpoint: '/capabilities', attempts: 3 },
          7,
        ],
      }),
    ).toBe(
      '[REMOTE_POLICY] Remote policy rejected the request | HTTP 403 | first; retryable: true; endpoint: /capabilities; attempts: 3; 7',
    )
  })

  it('formats structured command errors with plain object details', () => {
    expect(
      desktop.formatCommandError({
        code: 'PLAIN_DETAILS',
        message: 'Plain details',
        details: { endpoint: '/health', retryable: false },
      }),
    ).toBe('[PLAIN_DETAILS] Plain details | endpoint: /health; retryable: false')
  })

  it('normalizes evaluation results with snake_case payloads and filters invalid entries', async () => {
    invoke.mockResolvedValueOnce({
      evaluation_id: 'eval-123',
      status: 'success',
      summary: {
        score: 93,
        passed: 8,
        warnings: 1,
        failed: 0,
        severity_counts: {
          critical: 1,
          medium: 2,
          info: Number.NaN,
        },
        findings: [
          null,
          {
            rule_id: 'legacy-rule',
            status: 'warn',
            description: '  Legacy rule triggered.  ',
          },
        ],
        started_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:00:03Z',
      },
    })

    await expect(desktop.getEvaluationResult('eval-123')).resolves.toEqual({
      evaluationId: 'eval-123',
      status: 'success',
      summary: {
        score: 93,
        passed: 8,
        warnings: 1,
        failed: 0,
        severity_counts: {
          critical: 1,
          medium: 2,
          info: Number.NaN,
        },
        findings: [
          null,
          {
            rule_id: 'legacy-rule',
            status: 'warn',
            description: '  Legacy rule triggered.  ',
          },
        ],
        started_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:00:03Z',
      },
      severityCounts: {
        critical: 1,
        medium: 2,
      },
      findings: [
        {
          ruleId: 'legacy-rule',
          title: null,
          severity: null,
          status: 'warn',
          description: '  Legacy rule triggered.  ',
        },
      ],
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:03Z',
    })
  })

  it('normalizes artifact payloads with snake_case fields and drops invalid entries', async () => {
    invoke.mockResolvedValueOnce([
      null,
      {
        name: ' normalized-report ',
        kind: 'normalized_report',
        media_type: 'application/json',
      },
      {
        name: 'missing-media',
        kind: 'html',
      },
      {
        name: 'html-report',
        kind: 'html',
        mediaType: 'text/html',
        download_url: 'https://downloads.example.test/report.html',
      },
    ])

    await expect(desktop.getEvaluationArtifacts('eval-123')).resolves.toEqual([
      {
        name: ' normalized-report ',
        kind: 'normalized_report',
        mediaType: 'application/json',
        downloadUrl: null,
      },
      {
        name: 'html-report',
        kind: 'html',
        mediaType: 'text/html',
        downloadUrl: 'https://downloads.example.test/report.html',
      },
    ])
  })

  it('normalizes snake_case last-opened snapshots on the public API boundary', async () => {
    invoke.mockResolvedValueOnce({
      evaluation: {
        evaluation_id: 'eval-123',
        status: 'accepted',
        accepted_at: '2026-05-26T12:00:00Z',
      },
      evaluation_status: {
        evaluation_id: 'eval-123',
        status: 'success',
        stage: 'completed',
        progress_percent: 100,
        message: 'Evaluation complete.',
        exit_state: 'success',
        terminal: true,
      },
      evaluation_result: {
        evaluation_id: 'eval-123',
        status: 'success',
        summary: {
          score: 92,
          severity_counts: {
            critical: 1,
            low: 2,
          },
          findings: [
            {
              rule_id: 'tls-version',
              severity: 'medium',
              status: 'warn',
              description: 'TLS fallback still enabled.',
            },
          ],
          started_at: '2026-05-26T12:00:00Z',
          completed_at: '2026-05-26T12:00:03Z',
        },
      },
      artifacts: [
        {
          name: 'normalized-report',
          kind: 'normalized_report',
          media_type: 'application/json',
        },
      ],
    })

    await expect(desktop.getLastOpenedSnapshot()).resolves.toEqual({
      evaluation: {
        evaluationId: 'eval-123',
        status: 'accepted',
        acceptedAt: '2026-05-26T12:00:00Z',
      },
      evaluationStatus: {
        evaluationId: 'eval-123',
        status: 'success',
        stage: 'completed',
        progressPercent: 100,
        message: 'Evaluation complete.',
        exitState: 'success',
        terminal: true,
      },
      evaluationResult: {
        evaluationId: 'eval-123',
        status: 'success',
        summary: {
          score: 92,
          severity_counts: {
            critical: 1,
            low: 2,
          },
          findings: [
            {
              rule_id: 'tls-version',
              severity: 'medium',
              status: 'warn',
              description: 'TLS fallback still enabled.',
            },
          ],
          started_at: '2026-05-26T12:00:00Z',
          completed_at: '2026-05-26T12:00:03Z',
        },
        severityCounts: {
          critical: 1,
          low: 2,
        },
        findings: [
          {
            ruleId: 'tls-version',
            title: null,
            severity: 'medium',
            status: 'warn',
            description: 'TLS fallback still enabled.',
          },
        ],
        startedAt: '2026-05-26T12:00:00Z',
        completedAt: '2026-05-26T12:00:03Z',
      },
      artifacts: [
        {
          name: 'normalized-report',
          kind: 'normalized_report',
          mediaType: 'application/json',
          downloadUrl: null,
        },
      ],
    })
  })

  it('normalizes non-object evaluation results and non-array artifacts', async () => {
    invoke.mockResolvedValueOnce({
      evaluationId: 'eval-123',
      status: 'success',
      summary: null,
    })
    await expect(desktop.getEvaluationResult('eval-123')).resolves.toEqual({
      evaluationId: 'eval-123',
      status: 'success',
      summary: {},
      severityCounts: undefined,
      findings: undefined,
      startedAt: null,
      completedAt: null,
    })

    invoke.mockResolvedValueOnce(null)
    await expect(desktop.getEvaluationArtifacts('eval-123')).resolves.toEqual([])
  })

  it('drops empty severity counts and findings from evaluation results', async () => {
    invoke.mockResolvedValueOnce({
      evaluationId: 'eval-123',
      status: 'success',
      summary: {
        severity_counts: {
          info: Number.NaN,
        },
        findings: ['not-a-finding', {}],
      },
    })

    await expect(desktop.getEvaluationResult('eval-123')).resolves.toEqual({
      evaluationId: 'eval-123',
      status: 'success',
      summary: {
        severity_counts: {
          info: Number.NaN,
        },
        findings: ['not-a-finding', {}],
      },
      severityCounts: undefined,
      findings: undefined,
      startedAt: null,
      completedAt: null,
    })
  })

  it('falls back to generic command errors for strings, errors, and empty objects', () => {
    expect(desktop.formatCommandError('raw error')).toBe('raw error')
    expect(desktop.formatCommandError(new Error('boom'))).toBe('boom')
    expect(
      desktop.formatCommandError({
        message: '   ',
        details: null,
      }),
    ).toBe('Unknown desktop command error.')
    expect(desktop.formatCommandError(undefined)).toBe('Unknown desktop command error.')
  })

  it('rejects malformed snapshot payloads that are not objects', async () => {
    invoke.mockResolvedValueOnce('not-an-object')

    await expect(desktop.getLastOpenedSnapshot()).resolves.toBeNull()
  })
})
