export type BackendMode = 'local' | 'remote'

export type BackendConfig = {
  mode: BackendMode
  baseUrl: string
  timeoutMs: number
}

export type HealthResponse = {
  status: string
  service: string
  apiVersion: string
  appVersion?: string | null
}

export type ApiModeResponse = {
  mode: string
  baseUrl: string
  transport: string
  apiVersion: string
  supportsRemote: boolean
}

export type CapabilitiesResponse = {
  apiMode: ApiModeResponse
  evaluationProfiles: string[]
  outputFormats: string[]
  supportsRecon: boolean
  supportsArtifacts: boolean
}

export type CreateEvaluationRequest = {
  target: string
  profile: string
  outputFormats: string[]
  maxDepth: number
  maxUrls: number
  failOnCritical: boolean
  budgetGate: boolean
}

export type CreateEvaluationResponse = {
  evaluationId: string
  status: string
  acceptedAt?: string | null
}

export type EvaluationStatusResponse = {
  evaluationId: string
  status: string
  stage?: string | null
  progressPercent?: number | null
  message?: string | null
  exitState?: string | null
  terminal: boolean
}

export type CommandError = {
  code?: string
  message: string
  status?: number | null
  details?: unknown
}

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
