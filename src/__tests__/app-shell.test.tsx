import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '../App'
import * as desktop from '../lib/desktop'

vi.mock('../lib/desktop', () => ({
  isDesktopRuntime: vi.fn(),
  getBackendConfig: vi.fn(),
  setBackendConfig: vi.fn(),
  apiHealthCheck: vi.fn(),
  getCapabilities: vi.fn(),
  createEvaluation: vi.fn(),
  getEvaluationStatus: vi.fn(),
  getEvaluationResult: vi.fn(),
  getEvaluationArtifacts: vi.fn(),
  getLastOpenedSnapshot: vi.fn(),
  setLastOpenedSnapshot: vi.fn(),
  formatCommandError: vi.fn((error: unknown) => {
    if (typeof error === 'string') {
      return error
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = error.message
      if (typeof message === 'string') {
        return message
      }
    }

    return 'desktop error'
  }),
}))

const desktopApi = vi.mocked(desktop)

const backendConfig: desktop.BackendConfig = {
  mode: 'local',
  baseUrl: 'http://127.0.0.1:9000',
  port: 9000,
  timeoutMs: 10000,
}

const health: desktop.HealthResponse = {
  status: 'ok',
  service: 'stealth-lightbeacon-api',
  apiVersion: '0.1.0',
  appVersion: '2026.05.26',
  authRequired: false,
  compatibility: {
    minimumDesktopVersion: '0.1.0',
    recommendedDesktopVersion: '0.1.0',
  },
}

const capabilities: desktop.CapabilitiesResponse = {
  apiMode: {
    mode: 'local',
    baseUrl: backendConfig.baseUrl,
    transport: 'http',
    apiVersion: '0.1.0',
    supportsRemote: true,
  },
  evaluationProfiles: ['baseline', 'deep', 'export'],
  outputFormats: ['json', 'markdown', 'html'],
  supportsRecon: false,
  supportsArtifacts: true,
}

const successResult = {
  evaluationId: 'eval-123',
  status: 'success',
  summary: {
    score: 92,
    passed: 8,
    warnings: 1,
    failed: 0,
  },
  severityCounts: {
    critical: 0,
    high: 0,
    medium: 1,
    low: 2,
    info: 3,
  },
  findings: [
    {
      ruleId: 'tls-version',
      title: 'TLS version review',
      severity: 'medium',
      status: 'warn',
      description: 'Server still negotiates a legacy TLS fallback.',
    },
    {
      ruleId: 'security-headers',
      title: 'Security headers present',
      severity: 'low',
      status: 'pass',
      description: 'Core headers present in mock response.',
    },
  ],
  startedAt: '2026-01-15T10:00:00Z',
  completedAt: '2026-01-15T10:00:03Z',
}

const budgetBreachResult = {
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
    high: 1,
    medium: 2,
    low: 1,
    info: 2,
  },
  findings: [
    {
      ruleId: 'request-budget',
      title: 'Budget threshold reached',
      severity: 'high',
      status: 'fail',
      description: 'Run stopped after exceeding the configured request budget.',
    },
  ],
  startedAt: '2026-01-15T12:00:00Z',
  completedAt: '2026-01-15T12:00:03Z',
}

const artifacts = [
  {
    name: 'normalized-report',
    kind: 'normalized_report',
    mediaType: 'application/json',
    downloadUrl: 'https://downloads.example.test/eval-123/report.json',
  },
  {
    name: 'html-report',
    kind: 'html',
    mediaType: 'text/html',
    downloadUrl: 'https://downloads.example.test/eval-123/report.html',
  },
]

const lastOpenedSnapshot = {
  evaluation: {
    evaluationId: 'eval-cached',
    status: 'success',
    acceptedAt: '2026-05-25T08:00:00Z',
  },
  evaluationStatus: {
    evaluationId: 'eval-cached',
    status: 'success',
    stage: 'completed',
    progressPercent: 100,
    message: 'Cached terminal result.',
    exitState: 'success',
    terminal: true,
  },
  evaluationResult: {
    ...successResult,
    evaluationId: 'eval-cached',
  },
  artifacts,
}

describe('App shell', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    desktopApi.isDesktopRuntime.mockReturnValue(true)
    desktopApi.getBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.setBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.apiHealthCheck.mockResolvedValue(health)
    desktopApi.getCapabilities.mockResolvedValue(capabilities)
    desktopApi.getEvaluationResult.mockResolvedValue(successResult)
    desktopApi.getEvaluationArtifacts.mockResolvedValue(artifacts)
    desktopApi.getLastOpenedSnapshot.mockResolvedValue(null)
    desktopApi.setLastOpenedSnapshot.mockImplementation(async (snapshot) => snapshot)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads persisted backend config and capability data', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Stealth Lightbeacon' }),
    ).toBeInTheDocument()
    expect(await screen.findByDisplayValue(backendConfig.baseUrl)).toBeInTheDocument()
    expect(await screen.findByText('stealth-lightbeacon-api')).toBeInTheDocument()
    expect(await screen.findByText('baseline, deep, export')).toBeInTheDocument()
  })

  it('renders standalone mode metadata when the embedded engine is configured', async () => {
    desktopApi.getBackendConfig.mockResolvedValueOnce({
      mode: 'standalone',
      baseUrl: 'http://127.0.0.1:9311',
      port: 9311,
      timeoutMs: 10000,
    })
    desktopApi.apiHealthCheck.mockResolvedValueOnce({
      ...health,
      service: 'stealth-lightbeacon-standalone',
      apiVersion: '0.1.1',
    })
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      apiMode: {
        ...capabilities.apiMode,
        mode: 'standalone',
        transport: 'embedded',
      },
      evaluationProfiles: ['seo-foundation', 'accessibility-aa', 'full-spectrum'],
      supportsRecon: true,
    })

    render(<App />)

    expect((await screen.findAllByText('Standalone audit engine')).length).toBeGreaterThan(0)
    expect(await screen.findByText('Embedded ruleset')).toBeInTheDocument()
    expect(await screen.findByText('SEO / GEO / AEO / WCAG AA')).toBeInTheDocument()
  })

  it('switches between workspace tabs so settings are not all on one screen', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Audit' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Results' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Submit Evaluation' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save Connection' })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Settings' }))

    expect(await screen.findByRole('button', { name: 'Save Connection' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Workspace size')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit Evaluation' })).toBeNull()
  })

  it('offers standard laptop and desktop workspace sizes in settings', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Settings' }))

    const workspaceSize = await screen.findByLabelText('Workspace size')
    expect(
      screen.getByRole('option', { name: '13-inch laptop (1366 × 768)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '15-inch laptop (1440 × 900)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Desktop (1920 × 1080)' })).toBeInTheDocument()

    await user.selectOptions(workspaceSize, 'desktop')

    expect(screen.getByText('Workspace size')).toBeInTheDocument()
    expect(screen.getByText('Desktop / 1920 × 1080')).toBeInTheDocument()
  })

  it('saves edited backend connection settings through the desktop adapter', async () => {
    const user = userEvent.setup()
    const savedConfig: desktop.BackendConfig = {
      mode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
      timeoutMs: 10000,
    }
    desktopApi.setBackendConfig.mockResolvedValueOnce(savedConfig)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Settings' }))
    await user.selectOptions(await screen.findByLabelText('Backend mode'), 'remote')
    const baseUrlInput = await screen.findByLabelText('Backend base URL')
    fireEvent.change(baseUrlInput, { target: { value: 'https://api.example.test' } })
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '9443' } })
    await user.click(screen.getByRole('button', { name: 'Save Connection' }))

    await waitFor(() =>
      expect(desktopApi.setBackendConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'remote',
          baseUrl: 'https://api.example.test:9443',
          port: 9443,
          timeoutMs: 10000,
        }),
      ),
    )
  })

  it('blocks invalid evaluation requests before submit', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByLabelText('json'))
    await user.click(screen.getByLabelText('markdown'))
    fireEvent.change(screen.getByLabelText('Max depth'), {
      target: { value: '0' },
    })

    const submitButton = screen.getByRole('button', { name: 'Submit Evaluation' })
    expect(submitButton).toBeDisabled()
    expect(
      screen.getByText('Select at least one output format before submitting.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Max depth must be an integer between 1 and 8.'),
    ).toBeInTheDocument()
    expect(desktopApi.createEvaluation).not.toHaveBeenCalled()
  })

  it('keeps submission disabled when capabilities fail to load', async () => {
    desktopApi.getCapabilities.mockRejectedValueOnce('Capabilities endpoint failed.')
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    const submitButton = await screen.findByRole('button', {
      name: 'Submit Evaluation',
    })

    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
    expect(await screen.findByText('Capabilities unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('Reload backend capabilities before submitting an evaluation.'),
    ).toBeInTheDocument()
    expect(desktopApi.createEvaluation).not.toHaveBeenCalled()
  })

  it('surfaces remote auth requirements when protected capabilities fail', async () => {
    desktopApi.getCapabilities.mockRejectedValueOnce({
      code: 'unauthorized',
      message: 'Remote API auth required.',
      status: 401,
      details: 'SLB_API_AUTH_TOKEN',
    })

    render(<App />)

    expect(
      (
        await screen.findAllByText(
          'Capabilities unavailable. Remote API auth required.',
        )
      ).length,
    ).toBeGreaterThan(0)
  })

  it('surfaces incompatible desktop versions when protected capabilities fail', async () => {
    desktopApi.getCapabilities.mockRejectedValueOnce({
      code: 'incompatible_client',
      message: 'Desktop version is not supported by this backend.',
      status: 409,
      details: '0.0.1',
    })

    render(<App />)

    expect(
      (
        await screen.findAllByText(
          'Capabilities unavailable. Desktop version is not supported by this backend.',
        )
      ).length,
    ).toBeGreaterThan(0)
  })

  it('starts result fetch only after the evaluation reaches a terminal status', async () => {
    const user = userEvent.setup()
    desktopApi.createEvaluation.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'accepted',
      acceptedAt: '2026-05-26T12:00:00Z',
    })
    desktopApi.getEvaluationStatus
      .mockResolvedValueOnce({
        evaluationId: 'eval-123',
        status: 'running',
        stage: 'analysis',
        progressPercent: 45,
        message: 'Evaluation is still running.',
        exitState: null,
        terminal: false,
      })
      .mockResolvedValueOnce({
        evaluationId: 'eval-123',
        status: 'success',
        stage: 'completed',
        progressPercent: 100,
        message: 'Evaluation complete.',
        exitState: 'success',
        terminal: true,
      })

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await waitFor(() =>
      expect(desktopApi.createEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'https://example.com',
          profile: 'baseline',
        }),
      ),
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(1),
    )
    expect(desktopApi.getEvaluationResult).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(2),
      { timeout: 4000 },
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
      { timeout: 4000 },
    )
  })

  it('renders terminal success results after polling completes', async () => {
    const user = userEvent.setup()
    desktopApi.createEvaluation.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'accepted',
      acceptedAt: '2026-05-26T12:00:00Z',
    })
    desktopApi.getEvaluationStatus.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'success',
      stage: 'completed',
      progressPercent: 100,
      message: 'Evaluation complete.',
      exitState: 'success',
      terminal: true,
    })
    desktopApi.getEvaluationResult.mockResolvedValue(successResult)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: 'Results' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
      { timeout: 4000 },
    )

    await waitFor(
      () => expect(screen.getByText('Terminal report')).toBeInTheDocument(),
      { timeout: 4000 },
    )
  })

  it('renders terminal non-success results after polling completes', async () => {
    const user = userEvent.setup()
    desktopApi.createEvaluation.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'accepted',
      acceptedAt: '2026-05-26T12:00:00Z',
    })
    desktopApi.getEvaluationStatus.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'budget_breach',
      stage: 'completed',
      progressPercent: 100,
      message: 'Evaluation stopped at the budget gate.',
      exitState: 'budget_breach',
      terminal: true,
    })
    desktopApi.getEvaluationResult.mockResolvedValue(budgetBreachResult)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: 'Results' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
      { timeout: 4000 },
    )

    await waitFor(
      () => expect(screen.getByText('Terminal report')).toBeInTheDocument(),
      { timeout: 4000 },
    )
  })

  it('renders artifact metadata and actions after terminal completion', async () => {
    const user = userEvent.setup()
    desktopApi.createEvaluation.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'accepted',
      acceptedAt: '2026-05-26T12:00:00Z',
    })
    desktopApi.getEvaluationStatus.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'success',
      stage: 'completed',
      progressPercent: 100,
      message: 'Evaluation complete.',
      exitState: 'success',
      terminal: true,
    })

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: 'Results' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
      { timeout: 4000 },
    )

    await waitFor(() =>
      expect(desktopApi.getEvaluationArtifacts).toHaveBeenCalledWith('eval-123'),
    )
  })

  it('restores the last-opened terminal snapshot during bootstrap', async () => {
    const user = userEvent.setup()
    desktopApi.getLastOpenedSnapshot.mockResolvedValueOnce(lastOpenedSnapshot)

    render(<App />)

    expect(
      await screen.findByText('Accepted at 2026-05-25T08:00:00Z'),
    ).toBeInTheDocument()
    await user.click(await screen.findByRole('tab', { name: 'Results' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(await screen.findByText('Score 92')).toBeInTheDocument()
    expect(await screen.findByText('normalized-report')).toBeInTheDocument()
    expect(desktopApi.getEvaluationStatus).not.toHaveBeenCalled()
  })

  it('collapses trace and reporting panels on demand', async () => {
    const user = userEvent.setup()
    desktopApi.getLastOpenedSnapshot.mockResolvedValueOnce(lastOpenedSnapshot)

    render(<App />)

    expect(await screen.findByText('Last-opened snapshot restored')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse trace' }))
    expect(screen.getByRole('button', { name: 'Expand trace' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('trace-panel')).toHaveAttribute('hidden')

    await user.click(await screen.findByRole('tab', { name: 'Results' }))
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse reporting' }))
    expect(screen.getByRole('button', { name: 'Expand reporting' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('reporting-panel')).toHaveAttribute('hidden')
  })

  it('retries polling failures and allows manual recovery after repeated errors', async () => {
    const user = userEvent.setup()

    desktopApi.createEvaluation.mockResolvedValue({
      evaluationId: 'eval-123',
      status: 'accepted',
      acceptedAt: '2026-05-26T12:00:00Z',
    })
    desktopApi.getEvaluationStatus
      .mockRejectedValueOnce('Transient poll failure 1.')
      .mockRejectedValueOnce('Transient poll failure 2.')
      .mockRejectedValueOnce('Transient poll failure 3.')
      .mockResolvedValueOnce({
        evaluationId: 'eval-123',
        status: 'success',
        stage: 'completed',
        progressPercent: 100,
        message: 'Evaluation complete.',
        exitState: 'success',
        terminal: true,
      })

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: 'Audit' }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await waitFor(
      () => expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(3),
      { timeout: 4000 },
    )

    expect(await screen.findByText('Polling paused for eval-123 after 3 failed attempts.')).toBeInTheDocument()
    await user.click(await screen.findByRole('tab', { name: 'Overview' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(
      await screen.findByRole('button', { name: 'Resume Polling' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume Polling' }))

    await waitFor(() =>
      expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(4),
    )
    expect(
      await screen.findByText('Evaluation eval-123 finished with success'),
    ).toBeInTheDocument()
  }, 10000)
})
