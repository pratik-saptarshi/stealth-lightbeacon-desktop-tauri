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
  formatCommandError: vi.fn((error: unknown) =>
    typeof error === 'string' ? error : 'desktop error',
  ),
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
    vi.clearAllMocks()
    desktopApi.isDesktopRuntime.mockReturnValue(true)
    desktopApi.getBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.setBackendConfig.mockResolvedValue(backendConfig)
    desktopApi.apiHealthCheck.mockResolvedValue(health)
    desktopApi.getCapabilities.mockResolvedValue(capabilities)
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
})
