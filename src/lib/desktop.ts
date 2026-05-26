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
  details?: string | null
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

export function formatCommandError(error: unknown) {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const candidate = error as CommandError
    const parts = [candidate.message]
    if (candidate.status) {
      parts.push(`status ${candidate.status}`)
    }
    if (candidate.details) {
      parts.push(candidate.details)
    }
    return parts.filter(Boolean).join(' - ')
  }

  return 'Unknown desktop command error.'
}
