import {
  buildEvaluationHistoryView,
  buildEvaluationResultView,
  buildEvaluationReportDownloads,
  buildResultFindings,
  buildResultSeverityItems,
  buildResultSummaryMetrics,
  buildResultTimelineMetrics,
  buildRemotePolicyGuidance,
  buildUiShellStyle,
  classifyViewport,
  buildLoopbackBaseUrl,
  buildRemoteBaseUrl,
  compareVersionSegments,
  formatBackendMode,
  formatResultStatus,
  inferPortFromBaseUrl,
  loadUiSettings,
  getNextWorkspaceTabKey,
  isDesktopVersionBelow,
  readViewportState,
  resolveDesktopVersion,
  nextDraftConfigForMode,
  readFiniteNumber,
  summarizeHealth,
  resultToneClass,
  withPortApplied,
  validateEvaluationRequest,
} from '../App'
import type {
  BackendConfig,
  CapabilitiesResponse,
  CreateEvaluationRequest,
  EvaluationResultResponse,
} from '../lib/desktop'

describe('App helpers', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
        clear: () => {
          storage.clear()
        },
      },
    })
  })

  it('classifies viewport density across the supported breakpoints', () => {
    expect(classifyViewport(400, 500)).toBe('compact')
    expect(classifyViewport(1000, 760)).toBe('balanced')
    expect(classifyViewport(1600, 1000)).toBe('wide')
  })

  it('formats backend mode labels for all supported execution paths', () => {
    expect(formatBackendMode('local')).toBe('Local companion')
    expect(formatBackendMode('standalone')).toBe('Standalone audit engine')
    expect(formatBackendMode('remote')).toBe('Remote API')
  })

  it('infers ports from explicit and defaulted backend base URLs', () => {
    expect(inferPortFromBaseUrl('https://api.example.test:9443')).toBe(9443)
    expect(inferPortFromBaseUrl('https://api.example.test')).toBe(443)
    expect(inferPortFromBaseUrl('http://api.example.test')).toBe(80)
    expect(inferPortFromBaseUrl('not-a-url')).toBeNull()
  })

  it('switches draft backend config between local, standalone, and remote modes', () => {
    const remoteConfig: BackendConfig = {
      mode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
      timeoutMs: 15000,
    }

    expect(nextDraftConfigForMode('local', remoteConfig)).toMatchObject({
      mode: 'local',
      baseUrl: 'http://127.0.0.1:9443',
      port: 9443,
    })
    expect(nextDraftConfigForMode('standalone', remoteConfig)).toMatchObject({
      mode: 'standalone',
      baseUrl: 'http://127.0.0.1:9443',
      port: 9443,
    })
    expect(nextDraftConfigForMode('remote', remoteConfig)).toMatchObject({
      mode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
    })
  })

  it('validates evaluation requests against capability and range constraints', () => {
    const request: CreateEvaluationRequest = {
      target: ' ',
      profile: 'unsupported',
      outputFormats: ['json', 'xml'],
      maxDepth: 9,
      maxUrls: 0,
      failOnCritical: true,
      budgetGate: false,
    }
    const capabilities: CapabilitiesResponse = {
      apiMode: {
        mode: 'local',
        baseUrl: 'http://127.0.0.1:9000',
        transport: 'http',
        apiVersion: '0.1.0',
        supportsRemote: true,
      },
      evaluationProfiles: ['baseline'],
      outputFormats: ['json', 'markdown'],
      supportsRecon: true,
      supportsArtifacts: true,
    }

    expect(validateEvaluationRequest(request, capabilities)).toEqual([
      'Enter a target URL before submitting.',
      'Max depth must be an integer between 1 and 8.',
      'Max URLs must be an integer between 1 and 5000.',
      'Select a profile that the backend currently supports.',
      'Choose output formats that match the loaded backend capabilities.',
    ])
  })

  it('builds result views from summary, severity, timeline, and findings data', () => {
    const result: EvaluationResultResponse = {
      evaluationId: 'eval-123',
      status: 'budget_breach',
      summary: {
        score: 78,
        passed: 5,
        warnings: 2,
        failed: 1,
      },
      severityCounts: {
        critical: 0,
        medium: 2,
        info: 3,
        custom: 1,
      },
      findings: [
        {
          ruleId: 'headers',
          title: '  ',
          severity: 'medium',
          status: 'warn',
          description: '  Trimmed description  ',
        },
        {
          ruleId: 'fallback',
          severity: 'low',
          status: 'pass',
        },
      ],
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:03Z',
    }

    const view = buildEvaluationResultView(result)

    expect(view.statusLabel).toBe('budget breach')
    expect(view.summaryMetrics).toEqual([
      { label: 'Score', value: '78' },
      { label: 'Passed', value: '5' },
      { label: 'Warnings', value: '2' },
      { label: 'Failed', value: '1' },
    ])
    expect(view.severityItems).toEqual([
      'critical 0',
      'medium 2',
      'info 3',
      'custom 1',
    ])
    expect(view.timelineMetrics).toEqual([
      { label: 'Started', value: '2026-01-01T00:00:00Z' },
      { label: 'Completed', value: '2026-01-01T00:00:03Z' },
    ])
    expect(view.findings).toEqual([
      {
        key: 'headers',
        title: 'headers',
        meta: 'medium / warn',
        description: 'Trimmed description',
      },
      {
        key: 'fallback',
        title: 'fallback',
        meta: 'low / pass',
        description: null,
      },
    ])
  })

  it('builds history views and downloadable report exports for terminal runs', () => {
    const result: EvaluationResultResponse = {
      evaluationId: 'eval-123',
      status: 'success',
      summary: { score: 92 },
      severityCounts: { medium: 1 },
      findings: [],
      startedAt: '2026-01-15T10:00:00Z',
      completedAt: '2026-01-15T10:00:03Z',
    }
    const history = buildEvaluationHistoryView(
      {
        evaluationId: 'eval-123',
        status: 'accepted',
        acceptedAt: '2026-01-15T09:59:59Z',
      },
      {
        evaluationId: 'eval-123',
        status: 'success',
        stage: 'completed',
        progressPercent: 100,
        message: 'Evaluation complete.',
        exitState: 'success',
        terminal: true,
      },
      result,
      [
        {
          kind: 'html',
          name: 'html-report',
          mediaType: 'text/html',
          downloadUrl: 'https://downloads.example.test/report.html',
        },
      ],
    )

    expect(history).toEqual({
      evaluationId: 'eval-123',
      acceptedAt: '2026-01-15T09:59:59Z',
      statusLabel: 'success',
      stageLabel: 'completed',
      resultLabel: 'success',
      scoreLabel: 'Score 92',
      artifactCount: 1,
      detailLabel: 'Terminal report ready for download.',
    })

    const downloads = buildEvaluationReportDownloads('eval-123', result, [])

    expect(downloads).toEqual([
      expect.objectContaining({
        format: 'json',
        label: 'Download JSON report',
        filename: 'eval-123-report.json',
      }),
      expect.objectContaining({
        format: 'markdown',
        label: 'Download Markdown report',
        filename: 'eval-123-report.md',
      }),
      expect.objectContaining({
        format: 'html',
        label: 'Download HTML report',
        filename: 'eval-123-report.html',
      }),
    ])
    expect(downloads.every((download) => download.href.startsWith('data:'))).toBe(true)
  })

  it('builds report downloads with escaped content and empty collections', () => {
    const downloads = buildEvaluationReportDownloads(
      'eval-escape',
      {
        evaluationId: 'eval-escape',
        status: 'budget_breach',
        summary: {
          score: 73,
          warnings: 2,
          failed: 1,
        },
        severityCounts: {
          critical: 1,
        },
        findings: [],
        startedAt: '2026-01-15T10:00:00Z',
        completedAt: '2026-01-15T10:01:00Z',
      },
      [],
    )

    const markdown = decodeURIComponent(downloads[1].href.split(',')[1] ?? '')
    const html = decodeURIComponent(downloads[2].href.split(',')[1] ?? '')

    expect(downloads).toHaveLength(3)
    expect(markdown).toContain('No findings reported.')
    expect(markdown).toContain('No artifacts available.')
    expect(markdown).toContain('Severity: critical 1')
    expect(markdown).toContain('Warnings: 2')
    expect(html).toContain('<title>Stealth Lightbeacon Report eval-escape</title>')
    expect(html).toContain('<p>No findings reported.</p>')
    expect(html).toContain('<p>No artifacts available.</p>')
  })

  it('builds report downloads with escaped html content', () => {
    const downloads = buildEvaluationReportDownloads(
      'eval-html',
      {
        evaluationId: 'eval-html',
        status: 'success',
        summary: {
          score: 99,
        },
        severityCounts: {
          low: 1,
        },
        findings: [
          {
            ruleId: 'html-rule',
            title: '<b>Risky</b>',
            severity: 'low',
            status: 'warn',
            description: `Needs "quotes" & <tags>`,
          },
        ],
        startedAt: '2026-01-15T10:00:00Z',
        completedAt: '2026-01-15T10:01:00Z',
      },
      [
        {
          name: 'html<artifact>',
          kind: 'html',
          mediaType: 'text/html',
          downloadUrl: 'https://downloads.example.test/report?kind=<html>',
        },
      ],
    )

    const html = decodeURIComponent(downloads[2].href.split(',')[1] ?? '')

    expect(html).toContain('&lt;b&gt;Risky&lt;/b&gt;')
    expect(html).toContain('Needs &quot;quotes&quot; &amp; &lt;tags&gt;')
    expect(html).toContain('html&lt;artifact&gt;')
    expect(html).toContain('report?kind=&lt;html&gt;')
  })

  it('builds history views from queued evaluations without terminal results', () => {
    const history = buildEvaluationHistoryView(
      {
        evaluationId: 'eval-queued',
        status: 'accepted',
        acceptedAt: null,
      },
      {
        evaluationId: 'eval-queued',
        status: 'running',
        stage: 'queued',
        progressPercent: 0,
        message: null,
        exitState: null,
        terminal: false,
      },
      null,
      [],
    )

    expect(history).toEqual({
      evaluationId: 'eval-queued',
      acceptedAt: null,
      statusLabel: 'running',
      stageLabel: 'queued',
      resultLabel: null,
      scoreLabel: null,
      artifactCount: 0,
      detailLabel: 'Waiting for the terminal report.',
    })
  })

  it('covers workspace tab wrapping and version comparison helpers directly', () => {
    expect(getNextWorkspaceTabKey('overview', 'ArrowRight')).toBe('connection')
    expect(getNextWorkspaceTabKey('overview', 'ArrowLeft')).toBe('settings')
    expect(getNextWorkspaceTabKey('settings', 'ArrowDown')).toBe('overview')
    expect(getNextWorkspaceTabKey('audit', 'Home')).toBe('overview')
    expect(getNextWorkspaceTabKey('audit', 'End')).toBe('settings')
    expect(getNextWorkspaceTabKey('audit', 'Escape')).toBeNull()

    expect(compareVersionSegments('0.1.1', '0.1.0')).toBeGreaterThan(0)
    expect(compareVersionSegments('0.1.1', '0.2.0')).toBeLessThan(0)
    expect(compareVersionSegments('0.1.1', '0.1.1')).toBe(0)
    expect(isDesktopVersionBelow('0.2.0')).toBe(true)
    expect(isDesktopVersionBelow('0.1.0')).toBe(false)
    expect(isDesktopVersionBelow('0.2.0', '0.2.1')).toBe(false)
    expect(resolveDesktopVersion(null)).toBe('0.1.1')
    expect(
      resolveDesktopVersion({
        status: 'ok',
        service: 'stealth-lightbeacon-api',
        apiVersion: '0.1.0',
        appVersion: '0.4.0',
        authRequired: true,
        compatibility: {
          minimumDesktopVersion: '0.2.0',
          recommendedDesktopVersion: '0.2.1',
        },
      }),
    ).toBe('0.4.0')

    expect(
      buildRemotePolicyGuidance({
        status: 'ok',
        service: 'stealth-lightbeacon-api',
        apiVersion: '0.1.0',
        authRequired: true,
        compatibility: {
          minimumDesktopVersion: '0.2.0',
          recommendedDesktopVersion: '0.2.1',
        },
      }),
    ).toEqual([
      'Set STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN before reconnecting.',
      'Upgrade the desktop client to 0.2.0 or newer.',
    ])
  })

  it('uses the backend message when a queued evaluation has no terminal result yet', () => {
    const history = buildEvaluationHistoryView(
      {
        evaluationId: 'eval-message',
        status: 'accepted',
        acceptedAt: '2026-01-15T09:59:59Z',
      },
      {
        evaluationId: 'eval-message',
        status: 'running',
        stage: 'polling',
        progressPercent: 15,
        message: 'Polling the backend.',
        exitState: null,
        terminal: false,
      },
      null,
      [],
    )

    expect(history.detailLabel).toBe('Polling the backend.')
  })

  it('summarizes health and low-level formatting helpers', () => {
    expect(summarizeHealth(null)).toBe('Unavailable')
    expect(
      summarizeHealth({
        status: 'ok',
        service: 'stealth-lightbeacon-api',
        apiVersion: '0.1.0',
        authRequired: false,
        compatibility: {
          minimumDesktopVersion: '0.1.0',
          recommendedDesktopVersion: '0.1.0',
        },
      }),
    ).toBe('OK / API 0.1.0')
    expect(resultToneClass('success')).toBe('tone-good')
    expect(resultToneClass('budget_breach')).toBe('tone-idle')
    expect(readFiniteNumber(3.5)).toBe(3.5)
    expect(readFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatResultStatus('budget_breach')).toBe('budget breach')
    expect(buildLoopbackBaseUrl(8111)).toBe('http://127.0.0.1:8111')
    expect(buildRemoteBaseUrl(9443)).toBe('https://api.example.test:9443')
    expect(withPortApplied('https://api.example.test', 9443)).toBe(
      'https://api.example.test:9443',
    )
  })

  it('reads viewport defaults when no window object exists', () => {
    const originalWindow = window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(readViewportState()).toEqual({
        width: 800,
        height: 600,
        density: 'compact',
      })
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it('builds timeline metrics and finding fallbacks from partial result data', () => {
    expect(
      buildResultTimelineMetrics({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
        startedAt: '2026-01-01T00:00:00Z',
      }),
    ).toEqual([{ label: 'Started', value: '2026-01-01T00:00:00Z' }])

    expect(
      buildResultTimelineMetrics({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
        completedAt: '2026-01-01T00:00:03Z',
      }),
    ).toEqual([{ label: 'Completed', value: '2026-01-01T00:00:03Z' }])

    expect(
      buildResultFindings({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
        findings: [
          {
            severity: 'low',
            status: 'pass',
            description: '  description  ',
          },
        ],
      }),
    ).toEqual([
      {
        key: 'finding-0',
        title: 'Finding 1',
        meta: 'low / pass',
        description: 'description',
      },
    ])
  })

  it('loads ui settings from storage and falls back on malformed JSON', () => {
    const stored = {
      theme: {
        panelBg: '#111111',
        panelBorder: '#222222',
        cardBg: '#333333',
        accent: '#444444',
        button: '#555555',
      },
      sections: {
        recentActivity: false,
        currentEvaluation: true,
        terminalReport: false,
        backendSurface: true,
      },
    }
    window.localStorage?.setItem(
      'stealth-lightbeacon.ui-settings.v1',
      JSON.stringify(stored),
    )
    expect(loadUiSettings()).toEqual(stored)

    window.localStorage?.setItem('stealth-lightbeacon.ui-settings.v1', '{bad json')
    expect(loadUiSettings()).toMatchObject({
      theme: {
        panelBg: '#fffaf2',
        panelBorder: '#8f7860',
        cardBg: '#fff7ec',
        accent: '#245d56',
        button: '#244b4f',
      },
      sections: {
        recentActivity: true,
        currentEvaluation: true,
        terminalReport: true,
        backendSurface: true,
      },
    })
  })

  it('returns default ui settings when no stored preferences exist', () => {
    window.localStorage?.clear()

    expect(loadUiSettings()).toMatchObject({
      theme: {
        panelBg: '#fffaf2',
        panelBorder: '#8f7860',
        cardBg: '#fff7ec',
        accent: '#245d56',
        button: '#244b4f',
      },
      sections: {
        recentActivity: true,
        currentEvaluation: true,
        terminalReport: true,
        backendSurface: true,
      },
    })
  })

  it('returns default ui settings when storage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    })

    expect(loadUiSettings()).toMatchObject({
      theme: {
        panelBg: '#fffaf2',
        panelBorder: '#8f7860',
        cardBg: '#fff7ec',
        accent: '#245d56',
        button: '#244b4f',
      },
      sections: {
        recentActivity: true,
        currentEvaluation: true,
        terminalReport: true,
        backendSurface: true,
      },
    })
  })

  it('keeps valid ui settings fields and falls back on invalid partial input', () => {
    window.localStorage.setItem(
      'stealth-lightbeacon.ui-settings.v1',
      JSON.stringify({
        theme: {
          panelBg: '#123456',
          panelBorder: 'not-a-color',
          cardBg: '#234567',
          accent: '#345678',
          button: '#456789',
        },
        sections: {
          recentActivity: false,
          currentEvaluation: 'nope',
          terminalReport: false,
        },
      }),
    )

    expect(loadUiSettings()).toEqual({
      theme: {
        panelBg: '#123456',
        panelBorder: '#8f7860',
        cardBg: '#234567',
        accent: '#345678',
        button: '#456789',
      },
      sections: {
        recentActivity: false,
        currentEvaluation: true,
        terminalReport: false,
        backendSurface: true,
      },
    })
  })

  it('validates requests without capability data as long as the payload is well formed', () => {
    const request: CreateEvaluationRequest = {
      target: 'https://example.com',
      profile: 'baseline',
      outputFormats: ['json', 'markdown'],
      maxDepth: 2,
      maxUrls: 250,
      failOnCritical: true,
      budgetGate: false,
    }

    expect(validateEvaluationRequest(request, null)).toEqual([])
  })

  it('rejects empty output formats and unsupported profiles together', () => {
    const request: CreateEvaluationRequest = {
      target: 'https://example.com',
      profile: 'unsupported',
      outputFormats: [],
      maxDepth: 2,
      maxUrls: 250,
      failOnCritical: true,
      budgetGate: false,
    }

    expect(
      validateEvaluationRequest(request, {
        apiMode: {
          mode: 'remote',
          baseUrl: 'https://api.example.test:9443',
          transport: 'http',
          apiVersion: '0.1.0',
          supportsRemote: true,
        },
        evaluationProfiles: ['baseline'],
        outputFormats: ['json', 'markdown'],
        supportsRecon: false,
        supportsArtifacts: true,
      }),
    ).toEqual([
      'Select at least one output format before submitting.',
      'Select a profile that the backend currently supports.',
    ])
  })

  it('rejects fully invalid requests with every validation branch active', () => {
    const request: CreateEvaluationRequest = {
      target: ' ',
      profile: 'unsupported',
      outputFormats: [],
      maxDepth: 0,
      maxUrls: 0,
      failOnCritical: true,
      budgetGate: false,
    }

    expect(
      validateEvaluationRequest(request, {
        apiMode: {
          mode: 'remote',
          baseUrl: 'https://api.example.test:9443',
          transport: 'http',
          apiVersion: '0.1.0',
          supportsRemote: true,
        },
        evaluationProfiles: ['baseline'],
        outputFormats: ['json', 'markdown'],
        supportsRecon: true,
        supportsArtifacts: true,
      }),
    ).toEqual([
      'Enter a target URL before submitting.',
      'Select at least one output format before submitting.',
      'Max depth must be an integer between 1 and 8.',
      'Max URLs must be an integer between 1 and 5000.',
      'Select a profile that the backend currently supports.',
    ])
  })

  it('computes shell styles and tone helpers deterministically', () => {
    expect(
      buildUiShellStyle({
        theme: {
          panelBg: '#111111',
          panelBorder: '#222222',
          cardBg: '#333333',
          accent: '#444444',
          button: '#555555',
        },
        sections: {
          recentActivity: true,
          currentEvaluation: true,
          terminalReport: true,
          backendSurface: true,
        },
      }),
    ).toMatchObject({
      '--surface-panel-bg': '#111111',
      '--surface-panel-border': '#222222',
      '--surface-card-bg': '#333333',
      '--surface-accent': '#444444',
      '--surface-button': '#555555',
    })
    expect(resultToneClass('success')).toBe('tone-good')
    expect(resultToneClass('budget_breach')).toBe('tone-idle')
    expect(buildResultSummaryMetrics({ score: 10, passed: 2 })).toEqual([
      { label: 'Score', value: '10' },
      { label: 'Passed', value: '2' },
    ])
    expect(buildResultSeverityItems({ critical: 1, custom: 2 })).toEqual([
      'critical 1',
      'custom 2',
    ])
    expect(
      buildResultFindings({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
        findings: [{ ruleId: 'rule-1', status: 'pass' }],
      }),
    ).toEqual([
      {
        key: 'rule-1',
        title: 'rule-1',
        meta: 'pass',
        description: null,
      },
    ])
  })

  it('handles empty helper inputs without producing extra output', () => {
    expect(loadUiSettings()).toMatchObject({
      theme: {
        panelBg: '#fffaf2',
        panelBorder: '#8f7860',
        cardBg: '#fff7ec',
        accent: '#245d56',
        button: '#244b4f',
      },
      sections: {
        recentActivity: true,
        currentEvaluation: true,
        terminalReport: true,
        backendSurface: true,
      },
    })
    expect(buildResultSummaryMetrics({})).toEqual([])
    expect(buildResultSeverityItems(undefined)).toEqual([])
    expect(
      buildResultTimelineMetrics({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
      }),
    ).toEqual([])
    expect(
      buildResultFindings({
        evaluationId: 'eval-1',
        status: 'success',
        summary: {},
        findings: [],
      }),
    ).toEqual([])
    expect(withPortApplied('not-a-url', 9443)).toBe('not-a-url')
    expect(buildResultSummaryMetrics({ warnings: 2, failed: 1 })).toEqual([
      { label: 'Warnings', value: '2' },
      { label: 'Failed', value: '1' },
    ])
    expect(inferPortFromBaseUrl('https://api.example.test/path')).toBe(443)
    expect(inferPortFromBaseUrl('ftp://api.example.test')).toBeNull()
    expect(withPortApplied('   ', 9443)).toBe('https://api.example.test:9443')
  })
})
