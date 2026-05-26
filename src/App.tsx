import {
  useCallback,
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react'

import './App.css'
import {
  apiHealthCheck,
  createEvaluation,
  formatCommandError,
  getBackendConfig,
  getCapabilities,
  getEvaluationStatus,
  isDesktopRuntime,
  setBackendConfig,
  type BackendConfig,
  type BackendMode,
  type CapabilitiesResponse,
  type CreateEvaluationRequest,
  type CreateEvaluationResponse,
  type EvaluationStatusResponse,
  type HealthResponse,
} from './lib/desktop'

type ActivityItem = {
  id: number
  title: string
  detail: string
}

type CapabilitiesLoadState = 'idle' | 'loading' | 'ready' | 'failed'

const defaultBackendConfig: BackendConfig = {
  mode: 'local',
  baseUrl: 'http://127.0.0.1:8000',
  timeoutMs: 15000,
}

const defaultRequest: CreateEvaluationRequest = {
  target: 'https://example.com',
  profile: 'baseline',
  outputFormats: ['json', 'markdown'],
  maxDepth: 2,
  maxUrls: 250,
  failOnCritical: true,
  budgetGate: false,
}

const fallbackProfiles = ['baseline', 'deep', 'export']
const fallbackFormats = ['json', 'markdown', 'html']
const maxDepthBounds = { min: 1, max: 8 }
const maxUrlsBounds = { min: 1, max: 5000 }
const pollDelayMs = 1500
const maxAutomaticPollRetries = 2

function formatBackendMode(mode: BackendMode | string) {
  return mode === 'local' ? 'Local companion' : 'Remote API'
}

function summarizeHealth(health: HealthResponse | null) {
  if (!health) {
    return 'Unavailable'
  }

  return `${health.status.toUpperCase()} / API ${health.apiVersion}`
}

function isIntegerWithinRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

function validateEvaluationRequest(
  request: CreateEvaluationRequest,
  capabilities: CapabilitiesResponse | null,
) {
  const issues: string[] = []

  if (!request.target.trim()) {
    issues.push('Enter a target URL before submitting.')
  }

  if (request.outputFormats.length === 0) {
    issues.push('Select at least one output format before submitting.')
  }

  if (
    !isIntegerWithinRange(
      request.maxDepth,
      maxDepthBounds.min,
      maxDepthBounds.max,
    )
  ) {
    issues.push(
      `Max depth must be an integer between ${maxDepthBounds.min} and ${maxDepthBounds.max}.`,
    )
  }

  if (
    !isIntegerWithinRange(
      request.maxUrls,
      maxUrlsBounds.min,
      maxUrlsBounds.max,
    )
  ) {
    issues.push(
      `Max URLs must be an integer between ${maxUrlsBounds.min} and ${maxUrlsBounds.max}.`,
    )
  }

  if (capabilities) {
    if (!capabilities.evaluationProfiles.includes(request.profile)) {
      issues.push('Select a profile that the backend currently supports.')
    }

    const hasUnsupportedFormat = request.outputFormats.some(
      (format) => !capabilities.outputFormats.includes(format),
    )

    if (hasUnsupportedFormat) {
      issues.push('Choose output formats that match the loaded backend capabilities.')
    }
  }

  return issues
}

function App() {
  const desktopRuntime = isDesktopRuntime()
  const pollTimerRef = useRef<number | null>(null)
  const nextActivityIdRef = useRef(1)

  const [booting, setBooting] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshingConnection, setRefreshingConnection] = useState(false)
  const [backendConfig, setBackendConfigState] =
    useState<BackendConfig>(defaultBackendConfig)
  const [draftConfig, setDraftConfig] = useState<BackendConfig>(defaultBackendConfig)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [capabilities, setCapabilities] =
    useState<CapabilitiesResponse | null>(null)
  const [capabilitiesLoadState, setCapabilitiesLoadState] =
    useState<CapabilitiesLoadState>('idle')
  const [request, setRequest] = useState<CreateEvaluationRequest>(defaultRequest)
  const [activeEvaluation, setActiveEvaluation] =
    useState<CreateEvaluationResponse | null>(null)
  const [evaluationStatus, setEvaluationStatus] =
    useState<EvaluationStatusResponse | null>(null)
  const [pollingPaused, setPollingPaused] = useState(false)
  const [pollFailureCount, setPollFailureCount] = useState(0)
  const [pollError, setPollError] = useState<string | null>(null)
  const [pollRestartToken, setPollRestartToken] = useState(0)
  const [notice, setNotice] = useState(
    'Load backend settings, confirm health, then submit an evaluation job.',
  )
  const [statusLine, setStatusLine] = useState('Waiting for desktop runtime')
  const [activity, setActivity] = useState<ActivityItem[]>([
    {
      id: 0,
      title: 'Desktop bootstrap pending',
      detail: 'Phase 1 keeps the Tauri app thin and hands evaluation state to the backend API.',
    },
  ])

  const recordActivity = useCallback((title: string, detail: string) => {
    startTransition(() => {
      setActivity((current) => {
        if (current[0]?.title === title && current[0]?.detail === detail) {
          return current
        }

        return [
          {
            id: nextActivityIdRef.current++,
            title,
            detail,
          },
          ...current,
        ].slice(0, 4)
      })
    })
  }, [])

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const syncProfilesFromCapabilities = useCallback(
    (nextCapabilities: CapabilitiesResponse | null) => {
      const supportedProfiles =
        nextCapabilities?.evaluationProfiles.length
          ? nextCapabilities.evaluationProfiles
          : fallbackProfiles

      const supportedFormats =
        nextCapabilities?.outputFormats.length
          ? nextCapabilities.outputFormats
          : fallbackFormats

      startTransition(() => {
        setRequest((current) => ({
          ...current,
          profile: supportedProfiles.includes(current.profile)
            ? current.profile
            : supportedProfiles[0] ?? defaultRequest.profile,
          outputFormats: current.outputFormats.filter((format) =>
            supportedFormats.includes(format),
          ).length
            ? current.outputFormats.filter((format) =>
                supportedFormats.includes(format),
              )
            : [supportedFormats[0] ?? 'json'],
        }))
      })
    },
    [],
  )

  const refreshConnectionState = useCallback(async (mode: BackendMode) => {
    if (!desktopRuntime) {
      startTransition(() => {
        setHealth(null)
        setCapabilities(null)
        setCapabilitiesLoadState('idle')
        setNotice(
          'Desktop commands are unavailable in browser preview. Launch `npm run tauri:dev` to connect to the backend API.',
        )
        setStatusLine('Browser preview only')
      })
      return
    }

    setRefreshingConnection(true)
    setCapabilitiesLoadState('loading')
    try {
      const [nextHealthResult, nextCapabilitiesResult] = await Promise.allSettled([
        apiHealthCheck(),
        getCapabilities(),
      ])

      if (
        nextHealthResult.status === 'fulfilled' &&
        nextCapabilitiesResult.status === 'fulfilled'
      ) {
        startTransition(() => {
          setHealth(nextHealthResult.value)
          setCapabilities(nextCapabilitiesResult.value)
          setCapabilitiesLoadState('ready')
          setNotice(
            `${nextHealthResult.value.service} is reachable. Create an evaluation to begin polling backend job state.`,
          )
          setStatusLine(
            `${formatBackendMode(mode)} / ${nextHealthResult.value.apiVersion}`,
          )
        })
        syncProfilesFromCapabilities(nextCapabilitiesResult.value)
        recordActivity(
          'Backend connection verified',
          `${nextHealthResult.value.service} responded with API ${nextHealthResult.value.apiVersion}.`,
        )
        return
      }

      const healthMessage =
        nextHealthResult.status === 'rejected'
          ? formatCommandError(nextHealthResult.reason)
          : null
      const capabilitiesMessage =
        nextCapabilitiesResult.status === 'rejected'
          ? formatCommandError(nextCapabilitiesResult.reason)
          : null
      const nextNotice = capabilitiesMessage
        ? `Capabilities unavailable. ${capabilitiesMessage}`
        : healthMessage ?? 'Backend unavailable.'
      const nextStatusLine =
        nextHealthResult.status === 'fulfilled'
          ? capabilitiesMessage
            ? `${formatBackendMode(mode)} / ${nextHealthResult.value.apiVersion} / capabilities unavailable`
            : `${formatBackendMode(mode)} / ${nextHealthResult.value.apiVersion}`
          : 'Backend unavailable'

      startTransition(() => {
        setHealth(
          nextHealthResult.status === 'fulfilled' ? nextHealthResult.value : null,
        )
        setCapabilities(
          nextCapabilitiesResult.status === 'fulfilled'
            ? nextCapabilitiesResult.value
            : null,
        )
        setCapabilitiesLoadState(
          nextCapabilitiesResult.status === 'fulfilled' ? 'ready' : 'failed',
        )
        setNotice(nextNotice)
        setStatusLine(nextStatusLine)
      })

      if (nextCapabilitiesResult.status === 'fulfilled') {
        syncProfilesFromCapabilities(nextCapabilitiesResult.value)
      }

      recordActivity(
        nextCapabilitiesResult.status === 'rejected' &&
          nextHealthResult.status === 'fulfilled'
          ? 'Backend capabilities failed'
          : 'Backend connection failed',
        nextNotice,
      )
    } catch (error) {
      const message = formatCommandError(error)
      startTransition(() => {
        setHealth(null)
        setCapabilities(null)
        setCapabilitiesLoadState('failed')
        setNotice(message)
        setStatusLine('Backend unavailable')
      })
      recordActivity('Backend connection failed', message)
    } finally {
      setRefreshingConnection(false)
    }
  }, [desktopRuntime, recordActivity, syncProfilesFromCapabilities])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!desktopRuntime) {
        setBooting(false)
        setNotice(
          'Browser preview loaded. The desktop runtime is required to persist backend settings and call the API.',
        )
        setStatusLine('Desktop runtime unavailable')
        return
      }

      try {
        const storedConfig = await getBackendConfig()
        if (cancelled) {
          return
        }

        startTransition(() => {
          setBackendConfigState(storedConfig)
          setDraftConfig(storedConfig)
          setStatusLine(`${formatBackendMode(storedConfig.mode)} configured`)
        })
        recordActivity(
          'Backend config loaded',
          `${formatBackendMode(storedConfig.mode)} target ${storedConfig.baseUrl}.`,
        )

        await refreshConnectionState(storedConfig.mode)
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = formatCommandError(error)
        startTransition(() => {
          setNotice(message)
          setStatusLine('Bootstrap failed')
        })
        recordActivity('Desktop bootstrap failed', message)
      } finally {
        if (!cancelled) {
          setBooting(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      clearPollTimer()
    }
  }, [clearPollTimer, desktopRuntime, recordActivity, refreshConnectionState])

  useEffect(() => {
    if (!activeEvaluation?.evaluationId || !desktopRuntime || pollingPaused) {
      return
    }

    const evaluationId = activeEvaluation.evaluationId
    let cancelled = false
    let consecutiveFailures = 0
    clearPollTimer()

    async function pollOnce() {
      if (cancelled) {
        return
      }

      try {
        const nextStatus = await getEvaluationStatus(evaluationId)
        if (cancelled) {
          return
        }

        consecutiveFailures = 0
        startTransition(() => {
          setPollingPaused(false)
          setPollFailureCount(0)
          setPollError(null)
          setEvaluationStatus(nextStatus)
          setNotice(
            nextStatus.message ?? `Evaluation ${evaluationId} is ${nextStatus.status}.`,
          )
          setStatusLine(
            nextStatus.terminal
              ? `Evaluation ${evaluationId} finished with ${nextStatus.exitState ?? nextStatus.status}`
              : `Evaluation ${evaluationId} is ${nextStatus.status}`,
          )
        })

        if (nextStatus.terminal) {
          recordActivity(
            'Evaluation reached a terminal state',
            `${evaluationId} finished as ${nextStatus.exitState ?? nextStatus.status}.`,
          )
          return
        }

        recordActivity(
          'Evaluation status updated',
          `${evaluationId} is ${nextStatus.stage ?? nextStatus.status} at ${nextStatus.progressPercent ?? 0}%.`,
        )

        pollTimerRef.current = window.setTimeout(() => {
          void pollOnce()
        }, pollDelayMs)
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = formatCommandError(error)
        const nextFailureCount = consecutiveFailures + 1
        consecutiveFailures = nextFailureCount

        if (nextFailureCount <= maxAutomaticPollRetries) {
          startTransition(() => {
            setPollFailureCount(nextFailureCount)
            setPollError(message)
            setNotice(
              `Polling failed for ${evaluationId}. Retrying automatically (${nextFailureCount}/${maxAutomaticPollRetries}).`,
            )
            setStatusLine(`Retrying evaluation ${evaluationId}`)
          })
          recordActivity(
            'Evaluation polling retry scheduled',
            `${evaluationId}: ${message}`,
          )
          pollTimerRef.current = window.setTimeout(() => {
            void pollOnce()
          }, pollDelayMs)
          return
        }

        startTransition(() => {
          setPollFailureCount(nextFailureCount)
          setPollError(message)
          setPollingPaused(true)
          setNotice(
            `Polling paused for ${evaluationId} after ${nextFailureCount} failed attempts.`,
          )
          setStatusLine(`Polling paused for ${evaluationId}`)
        })
        recordActivity('Evaluation polling paused', `${evaluationId}: ${message}`)
      }
    }

    void pollOnce()

    return () => {
      cancelled = true
      clearPollTimer()
    }
  }, [
    activeEvaluation?.evaluationId,
    clearPollTimer,
    desktopRuntime,
    pollRestartToken,
    pollingPaused,
    recordActivity,
  ])

  async function handleSaveConnection() {
    if (!desktopRuntime) {
      setNotice(
        'Desktop commands are unavailable in browser preview. Launch `npm run tauri:dev` to save backend settings.',
      )
      setStatusLine('Preview mode')
      return
    }

    setSavingConfig(true)
    try {
      const saved = await setBackendConfig(draftConfig)
      startTransition(() => {
        setBackendConfigState(saved)
        setDraftConfig(saved)
        setNotice(`Saved ${formatBackendMode(saved.mode)} target ${saved.baseUrl}.`)
        setStatusLine(`${formatBackendMode(saved.mode)} saved`)
      })
      recordActivity(
        'Backend config saved',
        `${formatBackendMode(saved.mode)} target ${saved.baseUrl}.`,
      )
      await refreshConnectionState(saved.mode)
    } catch (error) {
      const message = formatCommandError(error)
      startTransition(() => {
        setNotice(message)
        setStatusLine('Save failed')
      })
      recordActivity('Backend config save failed', message)
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleCreateEvaluation() {
    if (!desktopRuntime) {
      setNotice(
        'Desktop commands are unavailable in browser preview. Launch `npm run tauri:dev` to submit an evaluation.',
      )
      setStatusLine('Preview mode')
      return
    }

    const requestValidationErrors = validateEvaluationRequest(
      request,
      capabilitiesLoadState === 'ready' ? capabilities : null,
    )
    const submissionGateMessage =
      capabilitiesLoadState === 'failed'
        ? 'Reload backend capabilities before submitting an evaluation.'
        : capabilitiesLoadState !== 'ready'
          ? 'Wait for backend capabilities before submitting an evaluation.'
          : !health
            ? 'Restore backend connectivity before submitting an evaluation.'
            : requestValidationErrors[0] ??
              'Evaluation request is not ready to submit.'

    if (
      capabilitiesLoadState !== 'ready' ||
      !health ||
      requestValidationErrors.length > 0
    ) {
      startTransition(() => {
        setNotice(submissionGateMessage)
        setStatusLine('Submission blocked')
      })
      recordActivity('Evaluation submission blocked', submissionGateMessage)
      return
    }

    clearPollTimer()
    setSubmitting(true)
    try {
      const accepted = await createEvaluation(request)
      startTransition(() => {
        setActiveEvaluation(accepted)
        setPollingPaused(false)
        setPollFailureCount(0)
        setPollError(null)
        setEvaluationStatus({
          evaluationId: accepted.evaluationId,
          status: accepted.status,
          stage: 'queued',
          progressPercent: 0,
          message: 'Evaluation accepted by backend.',
          exitState: null,
          terminal: false,
        })
        setNotice(`Run ${accepted.evaluationId} accepted by the backend API.`)
        setStatusLine(`Evaluation ${accepted.evaluationId} accepted`)
      })
      recordActivity(
        'Evaluation accepted',
        `${accepted.evaluationId} entered the backend queue.`,
      )
    } catch (error) {
      const message = formatCommandError(error)
      startTransition(() => {
        setNotice(message)
        setStatusLine('Submission failed')
      })
      recordActivity('Evaluation submission failed', message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleResumePolling() {
    if (!activeEvaluation?.evaluationId) {
      return
    }

    startTransition(() => {
      setPollingPaused(false)
      setPollFailureCount(0)
      setPollError(null)
      setNotice(`Resuming polling for ${activeEvaluation.evaluationId}.`)
      setStatusLine(`Retrying evaluation ${activeEvaluation.evaluationId}`)
    })
    recordActivity(
      'Evaluation polling resumed',
      `${activeEvaluation.evaluationId} manual recovery requested.`,
    )
    setPollRestartToken((current) => current + 1)
  }

  const availableProfiles =
    capabilities?.evaluationProfiles.length
      ? capabilities.evaluationProfiles
      : fallbackProfiles
  const availableFormats =
    capabilities?.outputFormats.length
      ? capabilities.outputFormats
      : fallbackFormats
  const progressValue = evaluationStatus?.progressPercent ?? 0
  const requestValidationErrors = validateEvaluationRequest(
    request,
    capabilitiesLoadState === 'ready' ? capabilities : null,
  )
  const submissionIssues = [
    ...(capabilitiesLoadState === 'failed'
      ? ['Reload backend capabilities before submitting an evaluation.']
      : capabilitiesLoadState !== 'ready'
        ? ['Wait for backend capabilities before submitting an evaluation.']
        : !health
          ? ['Restore backend connectivity before submitting an evaluation.']
          : []),
    ...requestValidationErrors,
  ]
  const canSubmit =
    desktopRuntime &&
    !submitting &&
    health !== null &&
    capabilitiesLoadState === 'ready' &&
    requestValidationErrors.length === 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OpenAPI-first desktop client</p>
          <div className="title-row">
            <h1>Stealth Lightbeacon</h1>
            <span className="status-pill status-live">
              {desktopRuntime ? 'Desktop runtime' : 'Browser preview'}
            </span>
          </div>
        </div>

        <div className="topbar-meta">
          <div className="meta-block">
            <span className="meta-label">Backend mode</span>
            <strong>{formatBackendMode(backendConfig.mode)}</strong>
          </div>
          <div className="meta-block">
            <span className="meta-label">Connection</span>
            <strong>{summarizeHealth(health)}</strong>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="main-column">
          <section className="panel hero-panel">
            <div className="hero-copy">
              <p className="section-kicker">Phase 1</p>
              <h2>Configure the backend, submit an evaluation, and poll its status.</h2>
              <p className="hero-text">
                The Tauri layer now acts as a secure API boundary. It stores the
                selected backend profile, calls `/health`, `/capabilities`, and
                `/evaluations`, then relays status back to the React shell.
              </p>
            </div>

            <div className="hero-metrics">
              <article className="metric-card">
                <span className="metric-label">Desktop boundary</span>
                <strong>{desktopRuntime ? 'Rust HTTP bridge' : 'Preview only'}</strong>
                <p>Tauri stores backend config and normalizes transport errors.</p>
              </article>
              <article className="metric-card">
                <span className="metric-label">API target</span>
                <strong>{backendConfig.baseUrl}</strong>
                <p>Local companion by default, remote override supported from the start.</p>
              </article>
              <article className="metric-card">
                <span className="metric-label">Active evaluation</span>
                <strong>{evaluationStatus?.status ?? 'Idle'}</strong>
                <p>
                  {activeEvaluation?.evaluationId
                    ? activeEvaluation.evaluationId
                    : 'No evaluation submitted yet'}
                </p>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Connectivity</p>
                <h2>Backend Connection</h2>
              </div>
              <span className="status-pill status-draft">
                {booting ? 'Bootstrapping' : health ? 'Connected' : 'Awaiting health'}
              </span>
            </div>

            <div className="config-grid">
              <label className="field">
                <span>Backend mode</span>
                <select
                  aria-label="Backend mode"
                  value={draftConfig.mode}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      mode: event.target.value as BackendMode,
                    }))
                  }
                >
                  <option value="local">Local companion</option>
                  <option value="remote">Remote API</option>
                </select>
              </label>

              <label className="field field-wide">
                <span>Backend base URL</span>
                <input
                  aria-label="Backend base URL"
                  type="text"
                  value={draftConfig.baseUrl}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Timeout (ms)</span>
                <input
                  aria-label="Timeout (ms)"
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={draftConfig.timeoutMs}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      timeoutMs: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>API version</span>
                <input
                  type="text"
                  value={health?.apiVersion ?? 'Unreachable'}
                  readOnly
                />
              </label>
            </div>

            <div className="notice-bar">
              <div>
                <span className="notice-label">Connection state</span>
                <p>{notice}</p>
              </div>
              <strong>{statusLine}</strong>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="primary-action"
                disabled={savingConfig || !desktopRuntime}
                onClick={() => void handleSaveConnection()}
              >
                {savingConfig ? 'Saving Connection' : 'Save Connection'}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={refreshingConnection || !desktopRuntime}
                onClick={() => void refreshConnectionState(backendConfig.mode)}
              >
                {refreshingConnection ? 'Checking Health' : 'Check Health'}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Submission</p>
                <h2>Evaluation Request</h2>
              </div>
              <span className="status-pill status-muted">
                {capabilitiesLoadState === 'ready'
                  ? 'Capabilities loaded'
                  : capabilitiesLoadState === 'failed'
                    ? 'Capabilities unavailable'
                    : 'Loading capabilities'}
              </span>
            </div>

            <div className="config-grid">
              <label className="field field-wide">
                <span>Target URL</span>
                <input
                  aria-label="Target URL"
                  type="text"
                  value={request.target}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      target: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Profile</span>
                <select
                  aria-label="Profile"
                  value={request.profile}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      profile: event.target.value,
                    }))
                  }
                >
                  {availableProfiles.map((profile) => (
                    <option key={profile} value={profile}>
                      {profile}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Max depth</span>
                <input
                  aria-label="Max depth"
                  type="number"
                  min={1}
                  max={8}
                  value={request.maxDepth}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      maxDepth: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Max URLs</span>
                <input
                  aria-label="Max URLs"
                  type="number"
                  min={1}
                  max={5000}
                  value={request.maxUrls}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      maxUrls: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className="focus-strip">
              <span className="focus-label">Output formats</span>
              <div className="checkbox-grid">
                {availableFormats.map((format) => {
                  const checked = request.outputFormats.includes(format)
                  return (
                    <label key={format} className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setRequest((current) => ({
                            ...current,
                            outputFormats: checked
                              ? current.outputFormats.filter(
                                  (item) => item !== format,
                                )
                              : [...current.outputFormats, format],
                          }))
                        }
                      />
                      <span>{format}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="toggle-grid">
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={request.failOnCritical}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      failOnCritical: event.target.checked,
                    }))
                  }
                />
                <span>Fail on critical findings</span>
              </label>

              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={request.budgetGate}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      budgetGate: event.target.checked,
                    }))
                  }
                />
                <span>Budget gate enabled</span>
              </label>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="primary-action"
                disabled={!canSubmit}
                onClick={() => void handleCreateEvaluation()}
              >
                {submitting ? 'Submitting Evaluation' : 'Submit Evaluation'}
              </button>
            </div>

            {submissionIssues.length > 0 ? (
              <div className="validation-list" role="alert" aria-live="polite">
                {submissionIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Recent activity</p>
                <h2>Desktop Adapter Trace</h2>
              </div>
              <span className="status-pill status-muted">Last four events</span>
            </div>

            <div className="run-list">
              {activity.map((item) => (
                <article key={item.id} className="run-card">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="side-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Status</p>
                <h2>Current Evaluation</h2>
              </div>
              <span className="status-pill status-soft">
                {evaluationStatus?.terminal ? 'Terminal' : 'Polling'}
              </span>
            </div>

            <div className="status-grid">
              <article className="status-card">
                <span className="metric-label">Evaluation ID</span>
                <strong>{evaluationStatus?.evaluationId ?? 'Not started'}</strong>
                <p>
                  {activeEvaluation?.acceptedAt
                    ? `Accepted at ${activeEvaluation.acceptedAt}`
                    : 'No backend job has been accepted yet.'}
                </p>
              </article>

              <article className="status-card">
                <span className="metric-label">Stage</span>
                <strong>{evaluationStatus?.stage ?? 'Idle'}</strong>
                <p>{evaluationStatus?.message ?? 'Waiting for the first poll cycle.'}</p>
              </article>

              <article className="status-card">
                <span className="metric-label">Progress</span>
                <strong>{progressValue}%</strong>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${progressValue}%` }} />
                </div>
              </article>

              <article className="status-card">
                <span className="metric-label">Exit state</span>
                <strong>{evaluationStatus?.exitState ?? 'In flight'}</strong>
                <p>
                  {evaluationStatus?.terminal
                    ? 'The backend reported a terminal state.'
                    : 'Polling continues until the backend marks this evaluation terminal.'}
                </p>
              </article>
            </div>

            {pollingPaused ? (
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleResumePolling}
                >
                  Resume Polling
                </button>
              </div>
            ) : null}

            {pollError ? (
              <div className="validation-list" role="status" aria-live="polite">
                <p>
                  Last polling error ({pollFailureCount}): {pollError}
                </p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Capabilities</p>
                <h2>Backend Surface</h2>
              </div>
            </div>

            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Service</span>
                  <strong className={health ? 'tone-good' : 'tone-idle'}>
                    {health?.service ?? 'Unavailable'}
                  </strong>
                </div>
                <p>Health checks come from `GET /health`.</p>
              </article>

              <article className="validation-card">
                <div className="validation-header">
                  <span>Profiles</span>
                  <strong className="tone-good">{availableProfiles.join(', ')}</strong>
                </div>
                <p>Capability options are loaded from `GET /capabilities`.</p>
              </article>

              <article className="validation-card">
                <div className="validation-header">
                  <span>Artifacts</span>
                  <strong
                    className={
                      capabilities?.supportsArtifacts ? 'tone-good' : 'tone-warn'
                    }
                  >
                    {capabilities?.supportsArtifacts ? 'Supported' : 'Deferred'}
                  </strong>
                </div>
                <p>Phase 2 consumes artifact routes without moving persistence into the client.</p>
              </article>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
