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
  getEvaluationArtifacts,
  getEvaluationResult,
  getEvaluationStatus,
  getLastOpenedSnapshot,
  isDesktopRuntime,
  setLastOpenedSnapshot,
  setBackendConfig,
  type ArtifactDescriptor,
  type BackendConfig,
  type BackendMode,
  type CapabilitiesResponse,
  type CreateEvaluationRequest,
  type CreateEvaluationResponse,
  type EvaluationResultResponse,
  type EvaluationStatusResponse,
  type HealthResponse,
} from './lib/desktop'

type ActivityItem = {
  id: number
  title: string
  detail: string
}

type CapabilitiesLoadState = 'idle' | 'loading' | 'ready' | 'failed'
type ResultLoadState = 'idle' | 'loading' | 'ready' | 'failed'

type EvaluationResultMetric = {
  label: string
  value: string
}

type EvaluationResultFindingView = {
  key: string
  title: string
  meta: string | null
  description: string | null
}

type EvaluationResultView = {
  statusLabel: string
  summaryMetrics: EvaluationResultMetric[]
  severityItems: string[]
  timelineMetrics: EvaluationResultMetric[]
  findings: EvaluationResultFindingView[]
}

const defaultPort = 8000

const defaultBackendConfig: BackendConfig = {
  mode: 'local',
  baseUrl: `http://127.0.0.1:${defaultPort}`,
  port: defaultPort,
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
const severityOrder = ['critical', 'high', 'medium', 'low', 'info'] as const

function formatBackendMode(mode: BackendMode | string) {
  switch (mode) {
    case 'local':
      return 'Local companion'
    case 'standalone':
      return 'Standalone audit engine'
    default:
      return 'Remote API'
  }
}

function buildLoopbackBaseUrl(port: number) {
  return `http://127.0.0.1:${port}`
}

function buildRemoteBaseUrl(port: number) {
  return `https://api.example.test:${port}`
}

function inferPortFromBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl)
    if (url.port) {
      return Number(url.port)
    }
    if (url.protocol === 'https:') {
      return 443
    }
    if (url.protocol === 'http:') {
      return 80
    }
  } catch {
    return null
  }

  return null
}

function withPortApplied(baseUrl: string, port: number) {
  try {
    const url = new URL(baseUrl.trim() || buildRemoteBaseUrl(port))
    url.port = String(port)
    return url.toString().replace(/\/$/, '')
  } catch {
    return baseUrl
  }
}

function nextDraftConfigForMode(mode: BackendMode, current: BackendConfig): BackendConfig {
  if (mode === 'remote') {
    return {
      ...current,
      mode,
      baseUrl:
        current.mode === 'remote' ? current.baseUrl : buildRemoteBaseUrl(current.port),
    }
  }

  return {
    ...current,
    mode,
    baseUrl: buildLoopbackBaseUrl(current.port),
  }
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

function readFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatResultStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function buildResultSummaryMetrics(summary: Record<string, unknown>) {
  const metrics: EvaluationResultMetric[] = []
  const score = readFiniteNumber(summary.score)
  const passed = readFiniteNumber(summary.passed)
  const warnings = readFiniteNumber(summary.warnings)
  const failed = readFiniteNumber(summary.failed)

  if (score !== null) {
    metrics.push({ label: 'Score', value: String(score) })
  }

  if (passed !== null) {
    metrics.push({ label: 'Passed', value: String(passed) })
  }

  if (warnings !== null) {
    metrics.push({ label: 'Warnings', value: String(warnings) })
  }

  if (failed !== null) {
    metrics.push({ label: 'Failed', value: String(failed) })
  }

  return metrics
}

function buildResultSeverityItems(severityCounts?: Record<string, number> | null) {
  if (!severityCounts) {
    return []
  }

  const orderedItems = severityOrder.flatMap((severity) =>
    typeof severityCounts[severity] === 'number'
      ? [`${severity} ${severityCounts[severity]}`]
      : [],
  )
  const unorderedItems = Object.entries(severityCounts).flatMap(([severity, count]) =>
    severityOrder.includes(severity as (typeof severityOrder)[number]) ||
    typeof count !== 'number'
      ? []
      : [`${severity} ${count}`],
  )

  return [...orderedItems, ...unorderedItems]
}

function buildResultTimelineMetrics(result: EvaluationResultResponse) {
  const metrics: EvaluationResultMetric[] = []

  if (result.startedAt) {
    metrics.push({ label: 'Started', value: result.startedAt })
  }

  if (result.completedAt) {
    metrics.push({ label: 'Completed', value: result.completedAt })
  }

  return metrics
}

function buildResultFindings(result: EvaluationResultResponse) {
  return (result.findings ?? []).map((finding, index) => ({
    key: finding.ruleId ?? `finding-${index}`,
    title: finding.title?.trim() || finding.ruleId?.trim() || `Finding ${index + 1}`,
    meta: [finding.severity, finding.status].filter(Boolean).join(' / ') || null,
    description: finding.description?.trim() || null,
  }))
}

function buildEvaluationResultView(result: EvaluationResultResponse): EvaluationResultView {
  return {
    statusLabel: formatResultStatus(result.status),
    summaryMetrics: buildResultSummaryMetrics(result.summary),
    severityItems: buildResultSeverityItems(result.severityCounts),
    timelineMetrics: buildResultTimelineMetrics(result),
    findings: buildResultFindings(result),
  }
}

function resultToneClass(status: string) {
  return status === 'success' ? 'tone-good' : 'tone-idle'
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
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResultResponse | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactDescriptor[]>([])
  const [resultLoadState, setResultLoadState] = useState<ResultLoadState>('idle')
  const [resultError, setResultError] = useState<string | null>(null)
  const [artifactsLoadState, setArtifactsLoadState] =
    useState<ResultLoadState>('idle')
  const [artifactsError, setArtifactsError] = useState<string | null>(null)
  const [traceExpanded, setTraceExpanded] = useState(true)
  const [reportExpanded, setReportExpanded] = useState(true)
  const [pollingPaused, setPollingPaused] = useState(false)
  const [pollFailureCount, setPollFailureCount] = useState(0)
  const [pollError, setPollError] = useState<string | null>(null)
  const [pollRestartToken, setPollRestartToken] = useState(0)
  const [shouldPollActiveEvaluation, setShouldPollActiveEvaluation] = useState(false)
  const [snapshotPersistedForEvaluationId, setSnapshotPersistedForEvaluationId] =
    useState<string | null>(null)
  const [notice, setNotice] = useState(
    'Choose companion, standalone, or remote mode, confirm health, then submit an audit run.',
  )
  const [statusLine, setStatusLine] = useState('Waiting for desktop runtime')
  const [activity, setActivity] = useState<ActivityItem[]>([
    {
      id: 0,
      title: 'Desktop bootstrap pending',
      detail:
        'The desktop shell coordinates companion, standalone, and remote audit execution paths.',
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

  const updateDraftMode = useCallback((mode: BackendMode) => {
    setDraftConfig((current) => nextDraftConfigForMode(mode, current))
  }, [])

  const updateDraftBaseUrl = useCallback((baseUrl: string) => {
    setDraftConfig((current) => ({
      ...current,
      baseUrl,
      port: current.mode === 'remote' ? inferPortFromBaseUrl(baseUrl) ?? current.port : current.port,
    }))
  }, [])

  const updateDraftPort = useCallback((portValue: string) => {
    const parsedPort = Number(portValue)
    setDraftConfig((current) => {
      const nextPort = Number.isFinite(parsedPort) ? Math.trunc(parsedPort) : 0
      return {
        ...current,
        port: nextPort,
        baseUrl:
          current.mode === 'remote'
            ? withPortApplied(current.baseUrl, nextPort || defaultPort)
            : buildLoopbackBaseUrl(nextPort || defaultPort),
      }
    })
  }, [])

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

        const snapshot = await getLastOpenedSnapshot()
        if (cancelled) {
          return
        }

        startTransition(() => {
          setBackendConfigState(storedConfig)
          setDraftConfig(storedConfig)
          setStatusLine(`${formatBackendMode(storedConfig.mode)} configured`)
          if (snapshot) {
            setActiveEvaluation(snapshot.evaluation)
            setEvaluationStatus(snapshot.evaluationStatus)
            setEvaluationResult(snapshot.evaluationResult)
            setArtifacts(snapshot.artifacts)
            setResultLoadState('ready')
            setArtifactsLoadState('ready')
            setResultError(null)
            setArtifactsError(null)
            setShouldPollActiveEvaluation(false)
            setSnapshotPersistedForEvaluationId(snapshot.evaluation.evaluationId)
          }
        })
        recordActivity(
          'Backend config loaded',
          `${formatBackendMode(storedConfig.mode)} target ${storedConfig.baseUrl}.`,
        )
        if (snapshot) {
          recordActivity(
            'Last-opened snapshot restored',
            `${snapshot.evaluation.evaluationId} restored from the terminal snapshot cache.`,
          )
        }

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
    if (
      !activeEvaluation?.evaluationId ||
      !desktopRuntime ||
      pollingPaused ||
      !shouldPollActiveEvaluation
    ) {
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
    shouldPollActiveEvaluation,
  ])

  useEffect(() => {
    if (
      !desktopRuntime ||
      !activeEvaluation?.evaluationId ||
      !evaluationStatus?.terminal ||
      resultLoadState !== 'idle'
    ) {
      return
    }

    const evaluationId = activeEvaluation.evaluationId
    let cancelled = false

    startTransition(() => {
      setResultLoadState('loading')
      setResultError(null)
    })

    async function loadResult() {
      try {
        const nextResult = await getEvaluationResult(evaluationId)
        if (cancelled) {
          return
        }

        startTransition(() => {
          setEvaluationResult(nextResult)
          setResultLoadState('ready')
          setResultError(null)
        })
        recordActivity(
          'Evaluation result loaded',
          `${evaluationId} result retrieved with ${nextResult.status}.`,
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = formatCommandError(error)
        startTransition(() => {
          setResultLoadState('failed')
          setResultError(message)
          setNotice(message)
          setStatusLine(`Evaluation ${evaluationId} result unavailable`)
        })
        recordActivity('Evaluation result failed', `${evaluationId}: ${message}`)
      }
    }

    void loadResult()

    return () => {
      cancelled = true
    }
  }, [
    activeEvaluation?.evaluationId,
    desktopRuntime,
    evaluationStatus?.terminal,
    recordActivity,
    resultLoadState,
  ])

  useEffect(() => {
    if (
      !desktopRuntime ||
      !activeEvaluation?.evaluationId ||
      !evaluationStatus?.terminal ||
      artifactsLoadState !== 'idle'
    ) {
      return
    }

    const evaluationId = activeEvaluation.evaluationId
    let cancelled = false

    startTransition(() => {
      setArtifactsLoadState('loading')
      setArtifactsError(null)
    })

    async function loadArtifacts() {
      try {
        const nextArtifacts = await getEvaluationArtifacts(evaluationId)
        if (cancelled) {
          return
        }

        startTransition(() => {
          setArtifacts(nextArtifacts)
          setArtifactsLoadState('ready')
          setArtifactsError(null)
        })
        recordActivity(
          'Evaluation artifacts loaded',
          `${evaluationId} returned ${nextArtifacts.length} artifact descriptors.`,
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = formatCommandError(error)
        startTransition(() => {
          setArtifactsLoadState('failed')
          setArtifactsError(message)
        })
        recordActivity('Evaluation artifacts failed', `${evaluationId}: ${message}`)
      }
    }

    void loadArtifacts()

    return () => {
      cancelled = true
    }
  }, [
    activeEvaluation?.evaluationId,
    artifactsLoadState,
    desktopRuntime,
    evaluationStatus?.terminal,
    recordActivity,
  ])

  useEffect(() => {
    if (
      !desktopRuntime ||
      !activeEvaluation ||
      !evaluationStatus?.terminal ||
      !evaluationResult ||
      artifactsLoadState !== 'ready' ||
      snapshotPersistedForEvaluationId === activeEvaluation.evaluationId
    ) {
      return
    }

    let cancelled = false
    const snapshot = {
      evaluation: activeEvaluation,
      evaluationStatus,
      evaluationResult,
      artifacts,
    }

    async function persistSnapshot() {
      try {
        const savedSnapshot = await setLastOpenedSnapshot(snapshot)
        if (cancelled || !savedSnapshot) {
          return
        }

        startTransition(() => {
          setSnapshotPersistedForEvaluationId(savedSnapshot.evaluation.evaluationId)
        })
        recordActivity(
          'Last-opened snapshot saved',
          `${savedSnapshot.evaluation.evaluationId} cached for the next desktop bootstrap.`,
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = formatCommandError(error)
        recordActivity('Last-opened snapshot failed', message)
      }
    }

    void persistSnapshot()

    return () => {
      cancelled = true
    }
  }, [
    activeEvaluation,
    artifacts,
    artifactsLoadState,
    desktopRuntime,
    evaluationResult,
    evaluationStatus,
    recordActivity,
    snapshotPersistedForEvaluationId,
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
        setShouldPollActiveEvaluation(true)
        setEvaluationResult(null)
        setArtifacts([])
        setResultLoadState('idle')
        setResultError(null)
        setArtifactsLoadState('idle')
        setArtifactsError(null)
        setSnapshotPersistedForEvaluationId(null)
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
  const terminalResultView = evaluationResult
    ? buildEvaluationResultView(evaluationResult)
    : null
  const remoteDraftMode = draftConfig.mode === 'remote'
  const reportAvailable = Boolean(evaluationStatus?.terminal)
  const modeOperationsCopy =
    backendConfig.mode === 'standalone'
      ? 'Embedded SEO, GEO, AEO, and WCAG 2.1/2.2 AA rules run inside the desktop boundary.'
      : backendConfig.mode === 'local'
        ? 'The desktop process supervises a loopback companion while keeping configuration and results inside Tauri.'
        : 'The desktop shell brokers remote HTTPS requests while preserving desktop-side validation and caching.'
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
        <div className="topbar-brand">
          <img
            className="brand-mark"
            src="/favicon.svg"
            alt="Stealth Lightbeacon audit beacon"
          />
          <div>
            <p className="eyebrow">Desktop audit operator</p>
            <div className="title-row">
              <h1>Stealth Lightbeacon</h1>
              <span className="status-pill status-live">
                {desktopRuntime ? 'Desktop runtime' : 'Browser preview'}
              </span>
            </div>
            <p className="brand-summary">
              SEO, GEO, AEO, and WCAG-guided audit orchestration across companion,
              standalone, and remote modes.
            </p>
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
              <p className="section-kicker">Execution Modes</p>
              <h2>Run audits through a companion service, embedded engine, or remote API.</h2>
              <p className="hero-text">
                The Tauri layer stores connection state, coordinates evaluation
                lifecycle, and now ships an embedded ruleset for SEO, GEO, AEO,
                and WCAG 2.1/2.2 AA coverage when you need a standalone run.
              </p>
            </div>

            <div className="hero-metrics">
              <article className="metric-card">
                <span className="metric-label">Execution path</span>
                <strong>{formatBackendMode(backendConfig.mode)}</strong>
                <p>{modeOperationsCopy}</p>
              </article>
              <article className="metric-card">
                <span className="metric-label">Connection target</span>
                <strong>{backendConfig.mode === 'standalone' ? 'Embedded ruleset' : backendConfig.baseUrl}</strong>
                <p>
                  {backendConfig.mode === 'remote'
                    ? `Remote HTTPS endpoint on port ${backendConfig.port}.`
                    : `Loopback default port ${backendConfig.port} is configurable.`}
                </p>
              </article>
              <article className="metric-card">
                <span className="metric-label">Audit coverage</span>
                <strong>SEO / GEO / AEO / WCAG AA</strong>
                <p>Embedded capability profiles keep accessibility checks aligned with search-facing analysis.</p>
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
                  onChange={(event) => updateDraftMode(event.target.value as BackendMode)}
                >
                  <option value="local">Local companion</option>
                  <option value="standalone">Standalone engine</option>
                  <option value="remote">Remote API</option>
                </select>
              </label>

              <label className="field">
                <span>Port</span>
                <input
                  aria-label="Port"
                  type="number"
                  min={1}
                  max={65535}
                  step={1}
                  value={draftConfig.port}
                  onChange={(event) => updateDraftPort(event.target.value)}
                />
                <small className="field-hint">
                  {remoteDraftMode
                    ? 'Overrides the remote endpoint port while preserving the current hostname.'
                    : 'Used for companion startup and preserved when switching execution modes.'}
                </small>
              </label>

              <label className="field field-wide">
                <span>{remoteDraftMode ? 'Backend base URL' : 'Loopback base URL'}</span>
                <input
                  aria-label={remoteDraftMode ? 'Backend base URL' : 'Loopback base URL'}
                  type="text"
                  value={draftConfig.baseUrl}
                  readOnly={!remoteDraftMode}
                  onChange={(event) => updateDraftBaseUrl(event.target.value)}
                />
                <small className="field-hint">
                  {remoteDraftMode
                    ? 'Use an absolute HTTPS endpoint for a managed companion service.'
                    : 'Standalone and local companion modes bind to loopback automatically.'}
                </small>
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
              <div className="heading-actions">
                <span className="status-pill status-muted">Last four events</span>
                <button
                  type="button"
                  className="collapse-toggle"
                  aria-expanded={traceExpanded}
                  aria-controls="trace-panel"
                  onClick={() => setTraceExpanded((current) => !current)}
                >
                  {traceExpanded ? 'Collapse trace' : 'Expand trace'}
                </button>
              </div>
            </div>

            <div id="trace-panel" className="run-list" hidden={!traceExpanded}>
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

            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Reporting</p>
                <h3>Terminal Report and Artifacts</h3>
              </div>
              <button
                type="button"
                className="collapse-toggle"
                aria-expanded={reportExpanded}
                aria-controls="reporting-panel"
                disabled={!reportAvailable}
                onClick={() => setReportExpanded((current) => !current)}
              >
                {reportExpanded ? 'Collapse reporting' : 'Expand reporting'}
              </button>
            </div>

            {!reportAvailable ? (
              <div className="validation-list">
                <article className="validation-card">
                  <div className="validation-header">
                    <span>Reporting</span>
                    <strong className="tone-idle">Waiting</strong>
                  </div>
                  <p>Terminal reports and artifact descriptors appear once the active audit reaches a terminal state.</p>
                </article>
              </div>
            ) : null}

            {evaluationStatus?.terminal ? (
              <div id="reporting-panel" className="validation-list" hidden={!reportExpanded}>
                <article className="validation-card">
                  <div className="validation-header">
                    <span>Terminal report</span>
                    <strong
                      className={
                        evaluationResult
                          ? resultToneClass(evaluationResult.status)
                          : 'tone-idle'
                      }
                    >
                      {terminalResultView?.statusLabel ??
                        (resultLoadState === 'failed' ? 'Unavailable' : 'Loading')}
                    </strong>
                  </div>
                  <p>
                    {resultLoadState === 'loading'
                      ? 'Fetching terminal result from GET /evaluations/{evaluation_id}/result.'
                      : resultLoadState === 'failed'
                        ? `Result retrieval failed. ${resultError ?? 'Unknown desktop command error.'}`
                        : 'Terminal result retrieved through the desktop adapter.'}
                  </p>
                </article>

                {terminalResultView?.summaryMetrics.length ? (
                  <article className="validation-card">
                    <div className="validation-header">
                      <span>Summary</span>
                      <strong className={resultToneClass(evaluationResult?.status ?? '')}>
                        {terminalResultView.summaryMetrics[0]?.label}{' '}
                        {terminalResultView.summaryMetrics[0]?.value}
                      </strong>
                    </div>
                    {terminalResultView.summaryMetrics.slice(1).map((metric) => (
                      <p key={metric.label}>
                        {metric.label} {metric.value}
                      </p>
                    ))}
                  </article>
                ) : null}

                {terminalResultView?.severityItems.length ? (
                  <article className="validation-card">
                    <div className="validation-header">
                      <span>Severity counts</span>
                      <strong className={resultToneClass(evaluationResult?.status ?? '')}>
                        {terminalResultView.severityItems[0]}
                      </strong>
                    </div>
                    {terminalResultView.severityItems.slice(1).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </article>
                ) : null}

                {terminalResultView?.timelineMetrics.length ? (
                  <article className="validation-card">
                    <div className="validation-header">
                      <span>Run timing</span>
                      <strong className="tone-idle">
                        {terminalResultView.timelineMetrics[0]?.label}{' '}
                        {terminalResultView.timelineMetrics[0]?.value}
                      </strong>
                    </div>
                    {terminalResultView.timelineMetrics.slice(1).map((metric) => (
                      <p key={metric.label}>
                        {metric.label} {metric.value}
                      </p>
                    ))}
                  </article>
                ) : null}

                {terminalResultView?.findings.map((finding) => (
                  <article key={finding.key} className="validation-card">
                    <div className="validation-header">
                      <span>Finding</span>
                      <strong className="tone-idle">{finding.title}</strong>
                    </div>
                    {finding.meta ? <p>{finding.meta}</p> : null}
                    {finding.description ? <p>{finding.description}</p> : null}
                  </article>
                ))}
                <article className="validation-card">
                  <div className="validation-header">
                    <span>Artifacts</span>
                    <strong className="tone-idle">
                      {artifactsLoadState === 'loading'
                        ? 'Loading'
                        : artifactsLoadState === 'failed'
                          ? 'Unavailable'
                          : `${artifacts.length} loaded`}
                    </strong>
                  </div>
                  <p>
                    {artifactsLoadState === 'failed'
                      ? `Artifact retrieval failed. ${artifactsError ?? 'Unknown desktop command error.'}`
                      : 'Artifact descriptors come from GET /evaluations/{evaluation_id}/artifacts.'}
                  </p>
                </article>

                {artifacts.map((artifact) => (
                  <article key={`${artifact.kind}-${artifact.name}`} className="validation-card">
                    <div className="validation-header">
                      <span>{artifact.kind}</span>
                      <strong className="tone-idle">{artifact.name}</strong>
                    </div>
                    <p>{artifact.mediaType}</p>
                    {artifact.downloadUrl ? (
                      <p>
                        <a href={artifact.downloadUrl} target="_blank" rel="noreferrer">
                          {`Open ${artifact.name}`}
                        </a>
                      </p>
                    ) : null}
                  </article>
                ))}
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
