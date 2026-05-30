import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  runRecon: vi.fn(),
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

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
    writable: true,
  })
  window.dispatchEvent(new Event('resize'))
}

function enableApiSetupTab() {
  if (!window.localStorage) {
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
        clear: () => storage.clear(),
      },
    })
  }
  window.localStorage.setItem(
    'stealth-lightbeacon.ui-settings.v1',
    JSON.stringify({ apiTabEnabled: true }),
  )
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

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
  supportsRecon: true,
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

const reconResult = {
  target: 'https://example.com',
  recommendation: 'stealth',
  posture: 'browser',
  confidence: 0.9,
  evidence: ['cloudflare', 'status:403'],
  evidenceSummary: 'cloudflare, status:403',
  signals: ['cloudflare'],
  autoSelectAllowed: true,
}

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
  const openReportingPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    const reportingToggle = await screen.findByRole('button', { name: /reporting/i })
    await waitFor(() => expect(reportingToggle).toBeEnabled(), { timeout: 4000 })
    if (reportingToggle.getAttribute('aria-expanded') === 'false') {
      await user.click(reportingToggle)
    }
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    window.localStorage?.clear?.()
    setViewportSize(800, 600)
    desktopApi.isDesktopRuntime.mockReturnValue(true)
    desktopApi.getBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.setBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.apiHealthCheck.mockResolvedValue(health)
    desktopApi.getCapabilities.mockResolvedValue(capabilities)
    desktopApi.getEvaluationResult.mockResolvedValue(successResult)
    desktopApi.getEvaluationArtifacts.mockResolvedValue(artifacts)
    desktopApi.runRecon.mockResolvedValue(reconResult)
    desktopApi.getLastOpenedSnapshot.mockResolvedValue(null)
    desktopApi.setLastOpenedSnapshot.mockImplementation(async (snapshot) => snapshot)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads persisted backend config and capability data', async () => {
    enableApiSetupTab()
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Stealth Lightbeacon' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Audit desktop')).toBeInTheDocument()
    expect(await screen.findByText('Standalone scan')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /^API/i }))

    expect(await screen.findByDisplayValue(backendConfig.baseUrl)).toBeInTheDocument()
    expect(await screen.findByText('stealth-lightbeacon-api')).toBeInTheDocument()
    expect(await screen.findByText('baseline, deep, export')).toBeInTheDocument()
  })

  it('shows browser preview mode when the desktop runtime is unavailable', async () => {
    desktopApi.isDesktopRuntime.mockReturnValue(false)
    enableApiSetupTab()
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Preview')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^API/i }))
    expect(
      await screen.findByText(
        'Browser preview loaded. The desktop runtime is required to persist backend settings and call the API.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Connection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Check Health' })).toBeDisabled()
  })

  it('keeps only the active workspace panel visible', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByRole('tab', { name: /^Scan/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(document.getElementById('workspace-panel-audit')).not.toHaveAttribute('hidden')

    await user.click(screen.getByRole('tab', { name: /^Settings/i }))

    expect(screen.getByRole('tab', { name: /^Settings/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(document.getElementById('workspace-panel-audit')).toHaveAttribute('hidden')
  })

  it('defaults to standalone-first workspace tabs without API setup', async () => {
    render(<App />)

    expect(await screen.findByRole('tab', { name: /^Scan/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /^Findings/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Reports/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Settings/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Home/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Connection/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^API/i })).not.toBeInTheDocument()
    expect(screen.getByText('Audit desktop')).toBeInTheDocument()
    expect(screen.getByText('Standalone scan')).toBeInTheDocument()
    expect(screen.queryByText(/Standalone SEO, GEO, AEO/i)).not.toBeInTheDocument()
  })

  it('applies compact text by default and lets settings adjust shell text size', async () => {
    const user = userEvent.setup()

    render(<App />)

    const appShell = document.querySelector('.app-shell') as HTMLElement | null
    expect(appShell?.style.getPropertyValue('--ui-font-scale')).toBe('0.65')

    await user.click(await screen.findByRole('tab', { name: /^Settings/i }))
    const scaleControl = screen.getByRole('slider', { name: 'Shell text size' })
    fireEvent.change(scaleControl, { target: { value: '0.85' } })

    expect(appShell?.style.getPropertyValue('--ui-font-scale')).toBe('0.85')
    expect(screen.getByText('85%')).toBeInTheDocument()
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

    expect((await screen.findAllByText('Standalone scan')).length).toBeGreaterThan(0)
    expect(await screen.findByText('Embedded ruleset')).toBeInTheDocument()
    expect(await screen.findByText('SEO / GEO / AEO / WCAG AA')).toBeInTheDocument()
  })

  it('saves edited backend connection settings through the desktop adapter', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()
    const savedConfig: desktop.BackendConfig = {
      mode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
      timeoutMs: 10000,
    }
    desktopApi.setBackendConfig.mockResolvedValueOnce(savedConfig)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^API/i }))
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

  it('surfaces backend connection save failures', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()
    desktopApi.setBackendConfig.mockRejectedValueOnce('Save exploded')

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^API/i }))
    await user.click(screen.getByRole('button', { name: 'Save Connection' }))

    expect((await screen.findAllByText('Save exploded')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Save failed')).length).toBeGreaterThan(0)
  })

  it('opens settings tab and applies custom panel colors', async () => {
    render(<App />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: /^Settings/i }))
    fireEvent.change(screen.getByLabelText('Panel background'), {
      target: { value: '#112233' },
    })

    expect(screen.getByText(/send bug reports to/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      'mailto:pratik.saptarshi@outlook.com?subject=Stealth%20Lightbeacon%20bug%20report',
    )
    const appShell = document.querySelector('.app-shell') as HTMLElement | null
    expect(appShell?.style.getPropertyValue('--surface-panel-bg')).toBe('#112233')
  })

  it('updates audit controls and workspace size preferences', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await user.clear(screen.getByLabelText('Max depth'))
    await user.type(screen.getByLabelText('Max depth'), '3')
    await user.clear(screen.getByLabelText('Max URLs'))
    await user.type(screen.getByLabelText('Max URLs'), '250')
    await user.click(screen.getByLabelText('html'))
    await user.click(screen.getByLabelText('html'))
    await user.click(screen.getByLabelText('Fail on critical findings'))
    await user.click(screen.getByLabelText('Budget gate enabled'))

    await user.click(screen.getByRole('tab', { name: /^API/i }))
    await user.clear(screen.getByLabelText('Timeout (ms)'))
    await user.type(screen.getByLabelText('Timeout (ms)'), '15000')
    await user.click(screen.getByRole('button', { name: 'Check Health' }))

    await user.click(screen.getByRole('tab', { name: /^Scan/i }))
    await user.selectOptions(screen.getByLabelText('Profile'), 'deep')
    await user.click(screen.getByRole('tab', { name: /^Settings/i }))
    await user.click(screen.getByRole('radio', { name: /^Wide desktop$/i }))
    const settingsPanel = screen.getByRole('tabpanel', { name: /^Settings/i })

    expect(screen.getByLabelText('Max depth')).toHaveValue(3)
    expect(screen.getByLabelText('Max URLs')).toHaveValue(250)
    expect(screen.getByLabelText('Timeout (ms)')).toHaveValue(15000)
    expect(screen.getByLabelText('Profile')).toHaveValue('deep')
    expect(screen.getByLabelText('Fail on critical findings')).not.toBeChecked()
    expect(screen.getByLabelText('Budget gate enabled')).toBeChecked()
    const appShell = document.querySelector('.app-shell')
    expect(appShell).toHaveAttribute(
      'data-workspace-size',
      'wideDesktop',
    )
    expect(appShell).toHaveClass(/app-shell--compact/)
    expect(
      within(settingsPanel).getByText(
        'Wide desktop layout defaults keep the shell compact for 1920 x 1080.',
      ),
    ).toBeInTheDocument()
  }, 15000)

  it('renders output formats as a compact horizontal bar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    const formatBar = screen.getByRole('group', { name: 'Output formats' })

    expect(formatBar).toHaveClass('output-format-bar')
    expect(within(formatBar).getByLabelText('json')).toBeChecked()
    expect(within(formatBar).getByLabelText('markdown')).toBeChecked()
    expect(within(formatBar).getByLabelText('html')).not.toBeChecked()
  })

  it('hides optional sections from the dashboard when disabled in settings', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Settings/i }))
    await user.click(screen.getByRole('checkbox', { name: /Recent activity/ }))
    await user.click(screen.getByRole('checkbox', { name: /Backend surface/ }))

    await user.click(screen.getByRole('tab', { name: /^Reports/i }))
    expect(screen.getByText('Recent activity is disabled in Settings.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^API/i }))
    expect(screen.getByText('Backend surface details are disabled in Settings.')).toBeInTheDocument()
  })

  it('hides current evaluation and terminal report surfaces when disabled in settings', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Settings/i }))
    await user.click(screen.getByRole('checkbox', { name: /Current evaluation/ }))
    await user.click(
      screen.getByRole('checkbox', { name: /Terminal report and artifacts/ }),
    )

    await user.click(screen.getByRole('tab', { name: /^Findings/i }))
    expect(
      await screen.findByText('Current evaluation cards are disabled in Settings.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Terminal reporting and artifact cards are disabled in Settings.'),
    ).toBeInTheDocument()
  })

  it('renders browser preview fallback when the desktop runtime is unavailable', async () => {
    desktopApi.isDesktopRuntime.mockReturnValue(false)
    enableApiSetupTab()

    render(<App />)

    expect(
      await screen.findByText(
        'Browser preview loaded. The desktop runtime is required to persist backend settings and call the API.',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByText('Desktop runtime unavailable')).toBeInTheDocument()
    await userEvent.setup().click(await screen.findByRole('tab', { name: /^API/i }))
    expect(
      screen.getByRole('button', { name: 'Save Connection' }),
    ).toBeInTheDocument()
  })

  it('blocks invalid evaluation requests before submit', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
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

  it('surfaces evaluation submission failures', async () => {
    const user = userEvent.setup()
    desktopApi.createEvaluation.mockRejectedValueOnce('Submission exploded')

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    expect((await screen.findAllByText('Submission exploded')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Submission failed')).length).toBeGreaterThan(0)
  })

  it('keeps submission disabled when capabilities fail to load', async () => {
    desktopApi.getCapabilities.mockRejectedValueOnce('Capabilities endpoint failed.')

    render(<App />)

    await userEvent.setup().click(await screen.findByRole('tab', { name: /^Scan/i }))
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
    enableApiSetupTab()
    desktopApi.apiHealthCheck.mockResolvedValueOnce({
      ...health,
      authRequired: true,
    })
    desktopApi.getCapabilities.mockRejectedValueOnce({
      code: 'unauthorized',
      message: 'Remote API auth required.',
      status: 401,
      details: 'SLB_API_AUTH_TOKEN',
    })

    render(<App />)

    await userEvent.setup().click(await screen.findByRole('tab', { name: /^API/i }))
    expect(
      (await screen.findAllByText(
        'Remote auth required. Set the backend auth token before loading protected capabilities.',
      )).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('surfaces incompatible desktop versions when protected capabilities fail', async () => {
    enableApiSetupTab()
    desktopApi.getCapabilities.mockRejectedValueOnce({
      code: 'incompatible_client',
      message: 'Desktop version is not supported by this backend.',
      status: 409,
      details: '0.0.1',
    })

    render(<App />)

    await userEvent.setup().click(await screen.findByRole('tab', { name: /^API/i }))
    expect(
      (await screen.findAllByText(
        /Desktop version is not supported by this backend\./,
      )).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('0.1.0+')).toBeInTheDocument()
  })

  it('runs recon when the backend advertises support for the target', async () => {
    const user = userEvent.setup()
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      supportsRecon: true,
    })

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))

    await waitFor(() =>
      expect(desktopApi.runRecon).toHaveBeenCalledWith({
        target: 'https://example.com',
      }),
    )
    expect(await screen.findByText('Recon completed for https://example.com.')).toBeInTheDocument()
    expect(await screen.findByText('stealth')).toBeInTheDocument()
    expect(await screen.findByText('browser')).toBeInTheDocument()
    expect(await screen.findByText('Confidence 90% · Auto-select Allowed')).toBeInTheDocument()
  })

  it.skip('clears recon output when the target changes during a pending rerun', async () => {
    const user = userEvent.setup()
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      supportsRecon: true,
    })
    const staleRecon = createDeferred<desktop.ReconResponse>()
    desktopApi.runRecon
      .mockResolvedValueOnce(reconResult)
      .mockReturnValueOnce(staleRecon.promise)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))

    await waitFor(() =>
      expect(desktopApi.runRecon).toHaveBeenCalledWith({
        target: 'https://example.com',
      }),
    )
    expect(await screen.findByText('stealth')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))
    await waitFor(() => expect(desktopApi.runRecon).toHaveBeenCalledTimes(2))

    await user.clear(screen.getByLabelText('Target URL'))
    await user.type(screen.getByLabelText('Target URL'), 'https://new.example')

    staleRecon.resolve({ ...reconResult, target: 'https://example.com' })

    await waitFor(() => expect(screen.queryByText('stealth')).not.toBeInTheDocument())
  })

  it('clears recon output when backend capabilities refresh during a pending rerun', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      supportsRecon: true,
    })
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      supportsRecon: false,
    })
    const staleRecon = createDeferred<desktop.ReconResponse>()
    desktopApi.runRecon
      .mockResolvedValueOnce(reconResult)
      .mockReturnValueOnce(staleRecon.promise)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))

    await waitFor(() =>
      expect(desktopApi.runRecon).toHaveBeenCalledWith({
        target: 'https://example.com',
      }),
    )
    expect(await screen.findByText('stealth')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))
    await waitFor(() => expect(desktopApi.runRecon).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('tab', { name: /^API/i }))
    await user.selectOptions(screen.getByLabelText('Backend mode'), 'remote')
    fireEvent.change(screen.getByLabelText('Backend base URL'), {
      target: { value: 'https://api.example.test' },
    })
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '9443' } })
    await user.click(screen.getByRole('button', { name: 'Save Connection' }))

    await user.click(screen.getByRole('tab', { name: /^Scan/i }))
    staleRecon.resolve({ ...reconResult, target: 'https://example.com' })

    await waitFor(() => expect(screen.queryByText('stealth')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Run Recon' })).toBeDisabled()
  })

  it('clears stale recon output after a failed rerun', async () => {
    const user = userEvent.setup()
    desktopApi.getCapabilities.mockResolvedValueOnce({
      ...capabilities,
      supportsRecon: true,
    })
    desktopApi.runRecon
      .mockResolvedValueOnce(reconResult)
      .mockRejectedValueOnce('Recon failed.')

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await user.click(screen.getByRole('button', { name: 'Run Recon' }))

    await waitFor(() =>
      expect(desktopApi.runRecon).toHaveBeenCalledWith({
        target: 'https://example.com',
      }),
    )
    expect(await screen.findByText('stealth')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run Recon' }))

    expect((await screen.findAllByText('Recon failed.')).length).toBeGreaterThan(0)
    expect(screen.queryByText('stealth')).not.toBeInTheDocument()
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

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
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

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: /^Findings/i }))
    await openReportingPanel(user)
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
    )
    expect((await screen.findAllByText('Terminal report')).length).toBeGreaterThan(0)
    expect(await screen.findByText('Recent Evaluations')).toBeInTheDocument()
    expect(screen.getAllByText('eval-123').length).toBeGreaterThan(0)
    expect(screen.queryByText('Formatted Reports')).not.toBeInTheDocument()
  }, 15000)

  it('surfaces terminal result retrieval failures', async () => {
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
    desktopApi.getEvaluationResult.mockRejectedValueOnce('Result exploded')
    desktopApi.getEvaluationArtifacts.mockResolvedValueOnce([])

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: /^Findings/i }))
    await openReportingPanel(user)
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
    )
  })

  it('surfaces artifact retrieval failures', async () => {
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
    desktopApi.getEvaluationArtifacts.mockRejectedValueOnce('Artifact exploded')

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: /^Findings/i }))
    await openReportingPanel(user)
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await waitFor(() =>
      expect(desktopApi.getEvaluationArtifacts).toHaveBeenCalledWith('eval-123'),
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

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: /^Findings/i }))
    await openReportingPanel(user)
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await waitFor(() =>
      expect(desktopApi.getEvaluationResult).toHaveBeenCalledWith('eval-123'),
    )
    expect((await screen.findAllByText('Terminal report')).length).toBeGreaterThan(0)
  }, 15000)

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

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await user.click(await screen.findByRole('tab', { name: /^Findings/i }))
    await openReportingPanel(user)
    await waitFor(() =>
      expect(desktopApi.getEvaluationArtifacts).toHaveBeenCalledWith('eval-123'),
    )
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'Artifact descriptors come from GET /evaluations/{evaluation_id}/artifacts.',
          ),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    )
    await waitFor(() =>
      expect(desktopApi.getEvaluationArtifacts).toHaveBeenCalledWith('eval-123'),
    )
  }, 15000)

  it('restores the last-opened terminal snapshot during bootstrap', async () => {
    desktopApi.getLastOpenedSnapshot.mockResolvedValueOnce(lastOpenedSnapshot)

    render(<App />)

    await userEvent.setup().click(await screen.findByRole('tab', { name: /^Findings/i }))
    await userEvent.setup().click(screen.getByRole('button', { name: /Expand reporting/i }))
    expect(
      await screen.findByText('Accepted at 2026-05-25T08:00:00Z'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Score 92')).toBeInTheDocument()
    expect((await screen.findAllByText('normalized-report')).length).toBeGreaterThan(0)
    expect(desktopApi.getEvaluationStatus).not.toHaveBeenCalled()
  })

  it('collapses trace and reporting panels on demand', async () => {
    const user = userEvent.setup()
    desktopApi.getLastOpenedSnapshot.mockResolvedValueOnce(lastOpenedSnapshot)
    setViewportSize(1280, 900)

    render(<App />)

    expect(await screen.findByText('Last-opened snapshot restored')).toBeInTheDocument()
    await user.click(await screen.findByRole('tab', { name: /^Reports/i }))
    expect(await screen.findByRole('table', { name: 'Report downloads' })).toBeInTheDocument()
    const downloadLinks = screen.getAllByRole('link', { name: /Download /i })
    expect(downloadLinks.length).toBe(2)
    expect(downloadLinks[0]).toHaveAttribute(
      'href',
      'https://downloads.example.test/eval-123/report.json',
    )
    expect(downloadLinks[1]).toHaveAttribute(
      'href',
      'https://downloads.example.test/eval-123/report.html',
    )
    expect(downloadLinks.every((link) => !link.getAttribute('href')?.startsWith('data:'))).toBe(
      true,
    )
    await user.click(screen.getByRole('button', { name: 'Collapse trace' }))
    expect(screen.getByRole('button', { name: 'Expand trace' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('trace-panel')).toHaveAttribute('hidden')

    await user.click(screen.getByRole('tab', { name: /^Findings/i }))
    expect(await screen.findByText('Terminal report')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse reporting' }))
    expect(screen.getByRole('button', { name: 'Expand reporting' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('reporting-panel')).toHaveAttribute('hidden')
  })

  it('toggles report links visibility from the reports panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Reports/i }))
    expect(await screen.findByRole('table', { name: 'Report downloads' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse report links' }))
    expect(screen.getByRole('button', { name: 'Expand report links' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('reports-links-panel')).toHaveAttribute('hidden')

    await user.click(screen.getByRole('button', { name: 'Expand report links' }))
    expect(screen.getByRole('button', { name: 'Collapse report links' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(document.getElementById('reports-links-panel')).not.toHaveAttribute('hidden')
  })

  it('toggles trace visibility from the reports panel in compact viewport', async () => {
    const user = userEvent.setup()
    setViewportSize(800, 600)

    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Reports/i }))
    expect(screen.getByRole('button', { name: 'Expand trace' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('trace-panel')).toHaveAttribute('hidden')

    await user.click(screen.getByRole('button', { name: 'Expand trace' }))
    expect(screen.getByRole('button', { name: 'Collapse trace' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(document.getElementById('trace-panel')).not.toHaveAttribute('hidden')

    await user.click(screen.getByRole('button', { name: 'Collapse trace' }))
    expect(screen.getByRole('button', { name: 'Expand trace' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('trace-panel')).toHaveAttribute('hidden')
  })

  it('hides trace toggle when recent activity section is disabled', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Settings/i }))
    await user.click(screen.getByRole('checkbox', { name: /Recent activity/ }))

    await user.click(screen.getByRole('tab', { name: /^Reports/i }))
    expect(screen.queryByRole('button', { name: /trace/i })).not.toBeInTheDocument()
    expect(screen.getByText('Recent activity is disabled in Settings.')).toBeInTheDocument()
  })

  it('renders a concise optimization hub in the scan tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))

    expect(await screen.findByText(/Web Companion Optimization Hub/i)).toBeInTheDocument()
    expect(screen.getByText(/One target. Four checks. One report./i)).toBeInTheDocument()
    expect(screen.getByText('Accessibility')).toBeInTheDocument()
    expect(screen.getByText('SEO / GEO / AEO')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Full Audit' })).toBeInTheDocument()
  })

  it('keeps reports focused on downloads instead of duplicating scan guidance', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('tab', { name: /^Reports/i }))
    const reportsPanel = screen.getByRole('tabpanel', { name: /^Reports/i })

    expect(within(reportsPanel).queryByText(/Web Companion Optimization Hub/i)).not.toBeInTheDocument()
    expect(within(reportsPanel).getByRole('heading', { name: /Reporting Operations/i })).toBeInTheDocument()
    expect(within(reportsPanel).getByRole('table', { name: 'Report downloads' })).toBeInTheDocument()
  })

  it('retries polling failures and allows manual recovery after repeated errors', async () => {
    const user = userEvent.setup()
    enableApiSetupTab()

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

    await user.click(await screen.findByRole('tab', { name: /^Scan/i }))
    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await waitFor(
      () => expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(3),
      { timeout: 4000 },
    )

    await user.click(await screen.findByRole('tab', { name: /^API/i }))
    expect(await screen.findByText('Polling paused for eval-123 after 3 failed attempts.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Findings/i }))
    expect(
      await screen.findByRole('button', { name: 'Resume Polling' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume Polling' }))

    await waitFor(() =>
      expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(4),
    )
    await user.click(await screen.findByRole('tab', { name: /^API/i }))
    expect(await screen.findByText('Evaluation eval-123 finished with success')).toBeInTheDocument()
  }, 10000)
})
