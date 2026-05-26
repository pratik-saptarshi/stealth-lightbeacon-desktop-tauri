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
  timeoutMs: 10000,
}

const health: desktop.HealthResponse = {
  status: 'ok',
  service: 'stealth-lightbeacon-api',
  apiVersion: '0.1.0',
  appVersion: '2026.05.26',
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

describe('App shell', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    desktopApi.isDesktopRuntime.mockReturnValue(true)
    desktopApi.getBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.setBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.apiHealthCheck.mockResolvedValue(health)
    desktopApi.getCapabilities.mockResolvedValue(capabilities)
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

  it('saves edited backend connection settings through the desktop adapter', async () => {
    const user = userEvent.setup()

    render(<App />)

    const baseUrlInput = await screen.findByLabelText('Backend base URL')
    fireEvent.change(baseUrlInput, { target: { value: 'http://api.example.test' } })
    await user.click(screen.getByRole('button', { name: 'Save Connection' }))

    await waitFor(() =>
      expect(desktopApi.setBackendConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'local',
          baseUrl: 'http://api.example.test',
          timeoutMs: 10000,
        }),
      ),
    )
  })

  it('blocks invalid evaluation requests before submit', async () => {
    const user = userEvent.setup()

    render(<App />)

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

    render(<App />)

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

  it('submits an evaluation and renders backend status data', async () => {
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
    expect(
      await screen.findByText('Evaluation eval-123 finished with success'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('The backend reported a terminal state.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('100%')).toBeInTheDocument()
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

    await screen.findByRole('button', { name: 'Submit Evaluation' })
    await user.click(screen.getByRole('button', { name: 'Submit Evaluation' }))

    await waitFor(
      () => expect(desktopApi.getEvaluationStatus).toHaveBeenCalledTimes(3),
      { timeout: 4000 },
    )

    expect(await screen.findByText('Polling paused for eval-123 after 3 failed attempts.')).toBeInTheDocument()
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
