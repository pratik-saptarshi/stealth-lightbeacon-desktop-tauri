import type {
  ArtifactDescriptor,
  BackendConfig,
  CapabilitiesResponse,
  CommandError,
  CreateEvaluationRequest,
  CreateEvaluationResponse,
  EvaluationFinding,
  EvaluationResultResponse,
  EvaluationStatusResponse,
  HealthResponse,
  LastOpenedSnapshot,
  ReconRequest,
  ReconResponse,
} from './desktop.types'

export type {
  ApiModeResponse,
  ArtifactDescriptor,
  BackendConfig,
  BackendMode,
  CapabilitiesResponse,
  CommandError,
  CompatibilityResponse,
  CreateEvaluationRequest,
  CreateEvaluationResponse,
  EvaluationFinding,
  EvaluationResultResponse,
  EvaluationStatusResponse,
  HealthResponse,
  LastOpenedSnapshot,
  ReconRequest,
  ReconResponse,
} from './desktop.types'

type InvokeArgs = Record<string, unknown> | undefined

export function isDesktopRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invokeCommand<T>(command: string, args?: InvokeArgs): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export async function getBackendConfig() {
  return invokeCommand<BackendConfig>('get_backend_config')
}

export async function setBackendConfig(config: BackendConfig) {
  return invokeCommand<BackendConfig>('set_backend_config', { config })
}

export async function apiHealthCheck() {
  return invokeCommand<HealthResponse>('api_health_check')
}

export async function getCapabilities() {
  return invokeCommand<CapabilitiesResponse>('get_capabilities')
}

export async function createEvaluation(request: CreateEvaluationRequest) {
  return invokeCommand<CreateEvaluationResponse>('create_evaluation', { request })
}

export async function getEvaluationStatus(evaluationId: string) {
  return invokeCommand<EvaluationStatusResponse>('get_evaluation_status', {
    evaluationId,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeSeverityCounts(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function normalizeFindings(value: unknown): EvaluationFinding[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const findings = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return []
    }

    const finding: EvaluationFinding = {
      ruleId: readString(item.ruleId ?? item.rule_id),
      title: readString(item.title),
      severity: readString(item.severity),
      status: readString(item.status),
      description: readString(item.description),
    }

    const hasRenderableField = Object.values(finding).some((field) => field != null)
    return hasRenderableField ? [{ ...finding, ruleId: finding.ruleId ?? `finding-${index}` }] : []
  })

  return findings.length > 0 ? findings : undefined
}

function normalizeEvaluationResultResponse(result: unknown): EvaluationResultResponse {
  const candidate = isRecord(result) ? result : {}
  const summary = isRecord(candidate.summary) ? candidate.summary : {}

  return {
    evaluationId: readString(candidate.evaluationId ?? candidate.evaluation_id) ?? '',
    status: readString(candidate.status) ?? '',
    summary,
    severityCounts: normalizeSeverityCounts(
      candidate.severityCounts ??
        candidate.severity_counts ??
        summary.severityCounts ??
        summary.severity_counts,
    ),
    findings: normalizeFindings(candidate.findings ?? summary.findings),
    startedAt: readString(
      candidate.startedAt ??
        candidate.started_at ??
        summary.startedAt ??
        summary.started_at,
    ),
    completedAt: readString(
      candidate.completedAt ??
        candidate.completed_at ??
        summary.completedAt ??
        summary.completed_at,
    ),
  }
}

export async function getEvaluationResult(evaluationId: string) {
  const result = await invokeCommand<unknown | undefined>('get_evaluation_result', {
    evaluationId,
  })

  return normalizeEvaluationResultResponse(result)
}

function normalizeArtifactDescriptor(value: unknown): ArtifactDescriptor | null {
  if (!isRecord(value)) {
    return null
  }

  const name = readString(value.name)
  const kind = readString(value.kind)
  const mediaType = readString(value.mediaType ?? value.media_type)

  if (!name || !kind || !mediaType) {
    return null
  }

  return {
    name,
    kind,
    mediaType,
    downloadUrl: readString(value.downloadUrl ?? value.download_url),
  }
}

function normalizeArtifacts(value: unknown): ArtifactDescriptor[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    const artifact = normalizeArtifactDescriptor(item)
    return artifact ? [artifact] : []
  })
}

export async function getEvaluationArtifacts(evaluationId: string) {
  const artifacts = await invokeCommand<unknown>('get_evaluation_artifacts', {
    evaluationId,
  })

  return normalizeArtifacts(artifacts)
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) =>
    typeof item === 'string' && item.trim().length > 0 ? [item] : [],
  )
}

function normalizeReconResponse(value: unknown): ReconResponse {
  const candidate = isRecord(value) ? value : {}
  const confidence =
    typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
      ? Math.min(1, Math.max(0, candidate.confidence))
      : 0

  return {
    target: readString(candidate.target) ?? '',
    recommendation: readString(candidate.recommendation) ?? '',
    posture: readString(candidate.posture) ?? '',
    confidence,
    evidence: normalizeStringArray(candidate.evidence),
    evidenceSummary: readString(candidate.evidenceSummary ?? candidate.evidence_summary) ?? '',
    signals: normalizeStringArray(candidate.signals),
    autoSelectAllowed: Boolean(
      candidate.autoSelectAllowed ?? candidate.auto_select_allowed,
    ),
  }
}

export async function runRecon(request: ReconRequest) {
  const result = await invokeCommand<unknown>('run_recon', { request })
  return normalizeReconResponse(result)
}

function normalizeLastOpenedSnapshot(value: unknown): LastOpenedSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const evaluationRecord = isRecord(value.evaluation) ? value.evaluation : null
  const statusRecord = isRecord(value.evaluationStatus ?? value.evaluation_status)
    ? ((value.evaluationStatus ?? value.evaluation_status) as Record<string, unknown>)
    : null
  const resultRecord = value.evaluationResult ?? value.evaluation_result

  if (!evaluationRecord || !statusRecord || !resultRecord) {
    return null
  }

  const evaluationId = readString(
    evaluationRecord.evaluationId ?? evaluationRecord.evaluation_id,
  )
  const status = readString(evaluationRecord.status)

  if (!evaluationId || !status) {
    return null
  }

  const evaluationStatusEvaluationId = readString(
    statusRecord.evaluationId ?? statusRecord.evaluation_id,
  )

  const normalizedStatus = {
    evaluationId: evaluationStatusEvaluationId ?? evaluationId,
    status: readString(statusRecord.status) ?? status,
    stage: readString(statusRecord.stage),
    progressPercent:
      typeof statusRecord.progressPercent === 'number'
        ? statusRecord.progressPercent
        : typeof statusRecord.progress_percent === 'number'
          ? statusRecord.progress_percent
          : null,
    message: readString(statusRecord.message),
    exitState: readString(statusRecord.exitState ?? statusRecord.exit_state),
    terminal: typeof statusRecord.terminal === 'boolean' ? statusRecord.terminal : false,
  }

  const normalizedResult = normalizeEvaluationResultResponse(resultRecord)

  if (
    !normalizedStatus.terminal ||
    normalizedStatus.evaluationId !== evaluationId ||
    normalizedResult.evaluationId !== evaluationId
  ) {
    return null
  }

  return {
    evaluation: {
      evaluationId,
      status,
      acceptedAt: readString(
        evaluationRecord.acceptedAt ?? evaluationRecord.accepted_at,
      ),
    },
    evaluationStatus: normalizedStatus,
    evaluationResult: normalizedResult,
    artifacts: normalizeArtifacts(value.artifacts),
  }
}

export async function getLastOpenedSnapshot() {
  const snapshot = await invokeCommand<unknown | undefined>('get_last_opened_snapshot')
  return normalizeLastOpenedSnapshot(snapshot)
}

export async function setLastOpenedSnapshot(snapshot: LastOpenedSnapshot) {
  const savedSnapshot = await invokeCommand<unknown>('set_last_opened_snapshot', {
    snapshot,
  })

  return normalizeLastOpenedSnapshot(savedSnapshot)
}

function formatCommandErrorValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return JSON.stringify(value)
  }

  return String(value)
}

function formatCommandErrorDetails(details: unknown): string[] {
  if (details == null) {
    return []
  }

  if (typeof details === 'string') {
    const trimmed = details.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(details)) {
    return details.flatMap((detail) => formatCommandErrorDetails(detail))
  }

  if (typeof details === 'object') {
    return Object.entries(details as Record<string, unknown>).map(
      ([key, value]) => `${key}: ${formatCommandErrorValue(value)}`,
    )
  }

  return [String(details)]
}

export function formatCommandError(error: unknown) {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const candidate = error as Partial<CommandError>
    const message =
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message.trim()
        : 'Unknown desktop command error.'
    const headline =
      typeof candidate.code === 'string' && candidate.code.trim()
        ? `[${candidate.code.trim()}] ${message}`
        : message
    const parts = [headline]

    if (typeof candidate.status === 'number' && Number.isFinite(candidate.status)) {
      parts.push(`HTTP ${candidate.status}`)
    }

    const details = formatCommandErrorDetails(candidate.details)
    if (details.length > 0) {
      parts.push(details.join('; '))
    }

    return parts.join(' | ')
  }

  return 'Unknown desktop command error.'
}
