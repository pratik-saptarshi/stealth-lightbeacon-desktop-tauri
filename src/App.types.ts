import type { BackendConfig, HealthResponse, CapabilitiesResponse, ArtifactDescriptor } from './lib/desktop'

export type ActivityItem = {
  id: number
  title: string
  detail: string
}

export type CapabilitiesLoadState = 'idle' | 'loading' | 'ready' | 'failed'
export type ResultLoadState = 'idle' | 'loading' | 'ready' | 'failed'

export type EvaluationResultMetric = {
  label: string
  value: string
}

export type EvaluationResultFindingView = {
  key: string
  title: string
  meta: string | null
  description: string | null
}

export type EvaluationResultView = {
  statusLabel: string
  summaryMetrics: EvaluationResultMetric[]
  severityItems: string[]
  timelineMetrics: EvaluationResultMetric[]
  findings: EvaluationResultFindingView[]
}

export type HistoryEntry = {
  evaluationId: string
  acceptedAt: string | null
  statusLabel: string
  stageLabel: string | null
  resultLabel: string | null
  scoreLabel: string | null
  artifactCount: number
  detailLabel: string
}

export type ReportDownloadFormat = 'json' | 'markdown' | 'html'

export type ReportDownloadView = {
  format: ReportDownloadFormat
  label: string
  filename: string
  href: string
}

export type UiThemeKey =
  | 'panelBg'
  | 'panelBorder'
  | 'cardBg'
  | 'accent'
  | 'button'

export type UiSectionKey =
  | 'recentActivity'
  | 'currentEvaluation'
  | 'terminalReport'
  | 'backendSurface'

export type WorkspaceTabKey =
  | 'overview'
  | 'connection'
  | 'audit'
  | 'results'
  | 'activity'
  | 'settings'

export type ViewportDensity = 'compact' | 'balanced' | 'wide'

export type ViewportState = {
  width: number
  height: number
  density: ViewportDensity
}

export type WorkspaceSizeKey = 'auto' | 'laptop13' | 'laptop15' | 'desktop' | 'wideDesktop'

export type WorkspaceLayout = {
  key: WorkspaceSizeKey
  label: string
  width: number
  height: number
  density: ViewportDensity
}

export type UiSettings = {
  theme: Record<UiThemeKey, string>
  sections: Record<UiSectionKey, boolean>
  workspaceSize: WorkspaceSizeKey
  fontScale: number
  apiTabEnabled: boolean
}

export type ThemeField = {
  key: UiThemeKey
  label: string
  description: string
}

export type SectionField = {
  key: UiSectionKey
  label: string
  description: string
}
