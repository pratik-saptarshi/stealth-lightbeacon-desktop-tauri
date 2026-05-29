export type BackendMode = 'local' | 'standalone' | 'remote'

export type BackendConfig = {
  mode: BackendMode
  baseUrl: string
  port: number
  timeoutMs: number
}

export type CompatibilityResponse = {
  minimumDesktopVersion: string
  recommendedDesktopVersion: string
}

export type HealthResponse = {
  status: string
  service: string
  apiVersion: string
  appVersion?: string | null
  authRequired: boolean
  compatibility: CompatibilityResponse
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

export type EvaluationFinding = {
  ruleId?: string | null
  title?: string | null
  severity?: string | null
  status?: string | null
  description?: string | null
}

export type EvaluationResultResponse = {
  evaluationId: string
  status: string
  summary: Record<string, unknown>
  severityCounts?: Record<string, number> | null
  findings?: EvaluationFinding[] | null
  startedAt?: string | null
  completedAt?: string | null
}

export type ArtifactDescriptor = {
  name: string
  kind: string
  mediaType: string
  downloadUrl?: string | null
}

export type ReconRequest = {
  target: string
}

export type ReconResponse = {
  target: string
  recommendation: string
  posture: string
  confidence: number
  evidence: string[]
  evidenceSummary: string
  signals: string[]
  autoSelectAllowed: boolean
}

export type LastOpenedSnapshot = {
  evaluation: CreateEvaluationResponse
  evaluationStatus: EvaluationStatusResponse
  evaluationResult: EvaluationResultResponse
  artifacts: ArtifactDescriptor[]
}

export type CommandError = {
  code?: string
  message: string
  status?: number | null
  details?: unknown
}
