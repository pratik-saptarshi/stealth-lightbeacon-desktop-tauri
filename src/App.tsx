import {
  useCallback,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'

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
  runRecon,
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
  type ReconResponse,
} from './lib/desktop'

type ActivityItem = {
  id: number
  title: string
  detail: string
}

type CapabilitiesLoadState = 'idle' | 'loading' | 'ready' | 'failed'
type ResultLoadState = 'idle' | 'loading' | 'ready' | 'failed'
type ReconLoadState = 'idle' | 'loading' | 'ready' | 'failed'
type ConnectionFailureCode = 'unauthorized' | 'incompatible_client' | 'other' | null

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

type ReconResultView = {
  recommendation: string
  posture: string
  confidenceLabel: string
  evidenceSummary: string
  evidence: string[]
  signals: string[]
  autoSelectAllowed: string
}

type EvaluationHistoryView = {
  evaluationId: string
  acceptedAt: string | null
  statusLabel: string
  stageLabel: string | null
  resultLabel: string | null
  scoreLabel: string | null
  artifactCount: number
  detailLabel: string
}

type ReportDownloadView = {
  label: string
  filename: string
  href: string
}

type UiThemeKey =
  | 'panelBg'
  | 'panelBorder'
  | 'cardBg'
  | 'accent'
  | 'button'

type UiSectionKey =
  | 'recentActivity'
  | 'currentEvaluation'
  | 'terminalReport'
  | 'backendSurface'

type WorkspaceTabKey =
  | 'overview'
  | 'connection'
  | 'audit'
  | 'results'
  | 'activity'
  | 'settings'

type ViewportDensity = 'compact' | 'balanced' | 'wide'

type ViewportState = {
  width: number
  height: number
  density: ViewportDensity
}

type WorkspaceSizeKey = 'auto' | 'laptop13' | 'laptop15' | 'desktop' | 'wideDesktop'

type WorkspaceSizeOption = {
  key: WorkspaceSizeKey
  label: string
  description: string
  width?: number
  height?: number
  density: ViewportDensity
}

type UiSettings = {
  theme: Record<UiThemeKey, string>
  sections: Record<UiSectionKey, boolean>
  workspaceSize: WorkspaceSizeKey
  fontScale: number
  apiTabEnabled: boolean
}

const defaultPort = 8000
const uiSettingsStorageKey = 'stealth-lightbeacon.ui-settings.v1'

const defaultBackendConfig: BackendConfig = {
  mode: 'standalone',
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
const defaultUiSettings: UiSettings = {
  theme: {
    panelBg: '#fffaf2',
    panelBorder: '#8f7860',
    cardBg: '#fff7ec',
    accent: '#245d56',
    button: '#244b4f',
  },
  sections: {
    recentActivity: true,
    currentEvaluation: true,
    terminalReport: true,
    backendSurface: true,
  },
  workspaceSize: 'auto',
  fontScale: 0.65,
  apiTabEnabled: false,
}
const workspaceSizeOptions: WorkspaceSizeOption[] = [
  {
    key: 'auto',
    label: 'Auto detect',
    description: 'Follow the current screen size and tune the shell automatically.',
    density: 'compact',
  },
  {
    key: 'laptop13',
    label: '13-inch laptop',
    description: 'Compact shell density for smaller notebook screens.',
    width: 1280,
    height: 800,
    density: 'compact',
  },
  {
    key: 'laptop15',
    label: '15-inch laptop',
    description: 'Balanced shell density for standard laptop panels.',
    width: 1440,
    height: 900,
    density: 'balanced',
  },
  {
    key: 'desktop',
    label: 'Desktop',
    description: 'Balanced shell density for common office desktops.',
    width: 1600,
    height: 1000,
    density: 'balanced',
  },
  {
    key: 'wideDesktop',
    label: 'Wide desktop',
    description: 'Wide shell density for large monitors and external displays.',
    width: 1920,
    height: 1080,
    density: 'wide',
  },
]
const uiThemeFields: Array<{
  key: UiThemeKey
  label: string
  description: string
}> = [
  {
    key: 'panelBg',
    label: 'Panel background',
    description: 'Main shell panels and the topbar surface.',
  },
  {
    key: 'cardBg',
    label: 'Card background',
    description: 'Metric cards, validation cards, and toggles.',
  },
  {
    key: 'panelBorder',
    label: 'Panel border',
    description: 'Outlines around the shell and nested cards.',
  },
  {
    key: 'accent',
    label: 'Accent color',
    description: 'Progress bars, decorative highlights, and status cues.',
  },
  {
    key: 'button',
    label: 'Primary action',
    description: 'Primary buttons in the main workflow.',
  },
]
const uiSectionFields: Array<{
  key: UiSectionKey
  label: string
  description: string
}> = [
  {
    key: 'recentActivity',
    label: 'Recent activity',
    description: 'Show the desktop adapter trace.',
  },
  {
    key: 'currentEvaluation',
    label: 'Current evaluation',
    description: 'Show the live evaluation status panel.',
  },
  {
    key: 'terminalReport',
    label: 'Terminal report and artifacts',
    description: 'Show the terminal result and artifact cards.',
  },
  {
    key: 'backendSurface',
    label: 'Backend surface',
    description: 'Show the health, profile, and artifact capability cards.',
  },
]

const workspaceTabs: Array<{
  key: WorkspaceTabKey
  label: string
  description: string
}> = [
  {
    key: 'overview',
    label: 'Home',
    description: 'Standalone audit summary.',
  },
  {
    key: 'connection',
    label: 'API Setup',
    description: 'Optional local or external API controls.',
  },
  {
    key: 'audit',
    label: 'Scan',
    description: 'Target, profile, and submission controls.',
  },
  {
    key: 'results',
    label: 'Findings',
    description: 'Live status, terminal report, and artifacts.',
  },
  {
    key: 'activity',
    label: 'Reports',
    description: 'Optimization hub and downloads.',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Display and workflow preferences.',
  },
]

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function getUiStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

export function loadUiSettings() {
  const storage = getUiStorage()
  if (!storage) {
    return defaultUiSettings
  }

  try {
    const stored = storage.getItem(uiSettingsStorageKey)
    if (!stored) {
      return defaultUiSettings
    }

    const parsed = JSON.parse(stored) as Partial<UiSettings> | null
    const theme = Object.fromEntries(
      uiThemeFields.map(({ key }) => [
        key,
        isHexColor(parsed?.theme?.[key]) ? parsed?.theme?.[key] : defaultUiSettings.theme[key],
      ]),
    ) as Record<UiThemeKey, string>
    const sections = Object.fromEntries(
      uiSectionFields.map(({ key }) => [
        key,
        typeof parsed?.sections?.[key] === 'boolean'
          ? parsed.sections[key]
          : defaultUiSettings.sections[key],
      ]),
    ) as Record<UiSectionKey, boolean>

    const workspaceSize = workspaceSizeOptions.some(({ key }) => key === parsed?.workspaceSize)
      ? (parsed?.workspaceSize ?? defaultUiSettings.workspaceSize)
      : defaultUiSettings.workspaceSize
    const parsedFontScale = Number(parsed?.fontScale)
    const fontScale =
      Number.isFinite(parsedFontScale) && parsedFontScale >= 0.55 && parsedFontScale <= 1.15
        ? parsedFontScale
        : defaultUiSettings.fontScale
    const apiTabEnabled =
      typeof parsed?.apiTabEnabled === 'boolean'
        ? parsed.apiTabEnabled
        : defaultUiSettings.apiTabEnabled

    return { theme, sections, workspaceSize, fontScale, apiTabEnabled }
  } catch {
    return defaultUiSettings
  }
}

export function buildUiShellStyle(uiSettings: UiSettings): CSSProperties {
  return {
    '--surface-panel-bg': uiSettings.theme.panelBg,
    '--surface-panel-border': uiSettings.theme.panelBorder,
    '--surface-card-bg': uiSettings.theme.cardBg,
    '--surface-accent': uiSettings.theme.accent,
    '--surface-button': uiSettings.theme.button,
    '--ui-font-scale': uiSettings.fontScale.toFixed(2),
  } as CSSProperties
}

function getWorkspaceSizeOption(workspaceSize: WorkspaceSizeKey) {
  return (
    workspaceSizeOptions.find((option) => option.key === workspaceSize) ??
    workspaceSizeOptions[0]
  )
}

export function classifyViewport(width: number, height: number): ViewportDensity {
  if (width < 920 || height < 680) {
    return 'compact'
  }

  if (width < 1360 || height < 860) {
    return 'balanced'
  }

  return 'wide'
}

export function readViewportState(): ViewportState {
  if (typeof window === 'undefined') {
    return {
      width: 800,
      height: 600,
      density: 'compact',
    }
  }

  const width = window.innerWidth
  const height = window.innerHeight

  return {
    width,
    height,
    density: classifyViewport(width, height),
  }
}

function resolveWorkspaceLayout(
  uiSettings: UiSettings,
  viewport: ViewportState,
): {
  key: WorkspaceSizeKey
  label: string
  width: number
  height: number
  density: ViewportDensity
} {
  const workspaceSizeOption = getWorkspaceSizeOption(uiSettings.workspaceSize)

  if (workspaceSizeOption.key === 'auto') {
    return {
      key: workspaceSizeOption.key,
      label:
        viewport.density === 'compact'
          ? 'Compact laptop'
          : viewport.density === 'balanced'
            ? 'Balanced desktop'
            : 'Wide desktop',
      width: viewport.width,
      height: viewport.height,
      density: viewport.density,
    }
  }

  return {
    key: workspaceSizeOption.key,
    label: workspaceSizeOption.label,
    width: workspaceSizeOption.width ?? viewport.width,
    height: workspaceSizeOption.height ?? viewport.height,
    density: viewport.density === 'compact' ? 'compact' : workspaceSizeOption.density,
  }
}

export function formatBackendMode(mode: BackendMode | string) {
  switch (mode) {
    case 'local':
      return 'Local companion'
    case 'standalone':
      return 'Standalone audit engine'
    default:
      return 'Remote API'
  }
}

export function buildLoopbackBaseUrl(port: number) {
  return `http://127.0.0.1:${port}`
}

export function buildRemoteBaseUrl(port: number) {
  return `https://api.example.test:${port}`
}

export function inferPortFromBaseUrl(baseUrl: string) {
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

export function withPortApplied(baseUrl: string, port: number) {
  try {
    const url = new URL(baseUrl.trim() || buildRemoteBaseUrl(port))
    url.port = String(port)
    return url.toString().replace(/\/$/, '')
  } catch {
    return baseUrl
  }
}

export function nextDraftConfigForMode(mode: BackendMode, current: BackendConfig): BackendConfig {
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

export function summarizeHealth(health: HealthResponse | null) {
  if (!health) {
    return 'Unavailable'
  }

  if (health.authRequired) {
    return `${health.status.toUpperCase()} / Auth required / API ${health.apiVersion}`
  }

  return `${health.status.toUpperCase()} / API ${health.apiVersion}`
}

function readCommandErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return null
  }

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && code.trim() ? code.trim() : null
}

function readCommandErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return null
  }

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' && Number.isFinite(status) ? status : null
}

function classifyConnectionFailure(error: unknown): ConnectionFailureCode {
  const code = readCommandErrorCode(error)?.toLowerCase() ?? null
  if (code === 'unauthorized' || code === 'incompatible_client') {
    return code
  }

  const status = readCommandErrorStatus(error)
  if (status === 401) {
    return 'unauthorized'
  }

  if (status === 409) {
    return 'incompatible_client'
  }

  return code ? 'other' : null
}

function formatConfidence(value: number) {
  const percentage = value <= 1 ? value * 100 : value
  return `${Math.round(percentage)}%`
}

function buildReconResultView(result: ReconResponse): ReconResultView {
  return {
    recommendation: result.recommendation,
    posture: result.posture,
    confidenceLabel: formatConfidence(result.confidence),
    evidenceSummary: result.evidenceSummary,
    evidence: result.evidence,
    signals: result.signals,
    autoSelectAllowed: result.autoSelectAllowed ? 'Allowed' : 'Manual only',
  }
}

function isIntegerWithinRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

export function validateEvaluationRequest(
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

export function readFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatResultStatus(status: string) {
  return status.replaceAll('_', ' ')
}

export function buildResultSummaryMetrics(summary: Record<string, unknown>) {
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

export function buildResultSeverityItems(severityCounts?: Record<string, number> | null) {
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

export function buildResultTimelineMetrics(result: EvaluationResultResponse) {
  const metrics: EvaluationResultMetric[] = []

  if (result.startedAt) {
    metrics.push({ label: 'Started', value: result.startedAt })
  }

  if (result.completedAt) {
    metrics.push({ label: 'Completed', value: result.completedAt })
  }

  return metrics
}

export function buildResultFindings(result: EvaluationResultResponse) {
  return (result.findings ?? []).map((finding, index) => ({
    key: finding.ruleId ?? `finding-${index}`,
    title: finding.title?.trim() || finding.ruleId?.trim() || `Finding ${index + 1}`,
    meta: [finding.severity, finding.status].filter(Boolean).join(' / ') || null,
    description: finding.description?.trim() || null,
  }))
}

export function buildEvaluationResultView(result: EvaluationResultResponse): EvaluationResultView {
  return {
    statusLabel: formatResultStatus(result.status),
    summaryMetrics: buildResultSummaryMetrics(result.summary),
    severityItems: buildResultSeverityItems(result.severityCounts),
    timelineMetrics: buildResultTimelineMetrics(result),
    findings: buildResultFindings(result),
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildDataUrl(mimeType: string, content: string) {
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`
}

export function buildEvaluationHistoryView(
  evaluation: CreateEvaluationResponse,
  evaluationStatus: EvaluationStatusResponse | null,
  evaluationResult: EvaluationResultResponse | null,
  artifacts: ArtifactDescriptor[],
): EvaluationHistoryView {
  const score = evaluationResult ? readFiniteNumber(evaluationResult.summary.score) : null

  return {
    evaluationId: evaluation.evaluationId,
    acceptedAt: evaluation.acceptedAt ?? null,
    statusLabel: formatResultStatus(
      evaluationStatus?.exitState ?? evaluationStatus?.status ?? evaluation.status,
    ),
    stageLabel: evaluationStatus?.stage ?? null,
    resultLabel: evaluationResult ? formatResultStatus(evaluationResult.status) : null,
    scoreLabel: score === null ? null : `Score ${score}`,
    artifactCount: artifacts.length,
    detailLabel: evaluationResult
      ? 'Terminal report ready for download.'
      : evaluationStatus?.message ?? 'Waiting for the terminal report.',
  }
}

function buildReportSummaryLines(
  evaluationId: string,
  result: EvaluationResultResponse,
  artifacts: ArtifactDescriptor[],
) {
  const view = buildEvaluationResultView(result)
  return [
    `Evaluation ID: ${evaluationId}`,
    `Status: ${view.statusLabel}`,
    ...view.summaryMetrics.map((metric) => `${metric.label}: ${metric.value}`),
    ...view.severityItems.map((item) => `Severity: ${item}`),
    ...view.timelineMetrics.map((metric) => `${metric.label}: ${metric.value}`),
    ...view.findings.map((finding) => {
      const parts = [finding.title]
      if (finding.meta) {
        parts.push(finding.meta)
      }
      if (finding.description) {
        parts.push(finding.description)
      }
      return `Finding: ${parts.join(' - ')}`
    }),
    ...artifacts.map((artifact) => {
      const parts = [`Artifact: ${artifact.name}`, artifact.kind, artifact.mediaType]
      if (artifact.downloadUrl) {
        parts.push(artifact.downloadUrl)
      }
      return parts.filter(Boolean).join(' | ')
    }),
  ]
}

function buildReportMarkdown(
  evaluationId: string,
  result: EvaluationResultResponse,
  artifacts: ArtifactDescriptor[],
) {
  const view = buildEvaluationResultView(result)
  const summaryLines = buildReportSummaryLines(evaluationId, result, artifacts)

  return [
    '# Stealth Lightbeacon Report',
    '',
    `- Evaluation ID: \`${evaluationId}\``,
    `- Status: ${view.statusLabel}`,
    ...view.summaryMetrics.map((metric) => `- ${metric.label}: ${metric.value}`),
    ...view.severityItems.map((item) => `- Severity: ${item}`),
    ...view.timelineMetrics.map((metric) => `- ${metric.label}: ${metric.value}`),
    '',
    '## Findings',
    ...(view.findings.length
      ? view.findings.flatMap((finding) => {
          const header = `- ${finding.title}`
          const details = [finding.meta, finding.description].filter(Boolean)
          return details.length
            ? [header, ...details.map((detail) => `  - ${detail}`)]
            : [header]
        })
      : ['- No findings reported.']),
    '',
    '## Artifacts',
    ...(artifacts.length
      ? artifacts.map((artifact) => {
          const details = [
            `- ${artifact.name}`,
            `  - Kind: ${artifact.kind}`,
            `  - Media type: ${artifact.mediaType}`,
            artifact.downloadUrl ? `  - Download: ${artifact.downloadUrl}` : null,
          ].filter(Boolean)
          return details.join('\n')
        })
      : ['- No artifacts available.']),
    '',
    '## Summary',
    ...summaryLines.map((line) => `- ${line}`),
    '',
  ].join('\n')
}

function buildReportHtml(
  evaluationId: string,
  result: EvaluationResultResponse,
  artifacts: ArtifactDescriptor[],
) {
  const view = buildEvaluationResultView(result)
  const summaryItems = [
    ...view.summaryMetrics.map(
      (metric) => `<li><strong>${escapeHtml(metric.label)}</strong> ${escapeHtml(metric.value)}</li>`,
    ),
    ...view.severityItems.map((item) => `<li>${escapeHtml(item)}</li>`),
    ...view.timelineMetrics.map(
      (metric) => `<li><strong>${escapeHtml(metric.label)}</strong> ${escapeHtml(metric.value)}</li>`,
    ),
  ].join('')

  const findingItems = view.findings.length
    ? view.findings
        .map(
          (finding) => `
            <article>
              <h3>${escapeHtml(finding.title)}</h3>
              ${finding.meta ? `<p><strong>Meta:</strong> ${escapeHtml(finding.meta)}</p>` : ''}
              ${finding.description ? `<p>${escapeHtml(finding.description)}</p>` : ''}
            </article>
          `,
        )
        .join('')
    : '<p>No findings reported.</p>'

  const artifactItems = artifacts.length
    ? artifacts
        .map(
          (artifact) => `
            <article>
              <h3>${escapeHtml(artifact.name)}</h3>
              <p><strong>Kind:</strong> ${escapeHtml(artifact.kind)}</p>
              <p><strong>Media type:</strong> ${escapeHtml(artifact.mediaType)}</p>
              ${artifact.downloadUrl ? `<p><strong>Download:</strong> ${escapeHtml(artifact.downloadUrl)}</p>` : ''}
            </article>
          `,
        )
        .join('')
    : '<p>No artifacts available.</p>'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stealth Lightbeacon Report ${escapeHtml(evaluationId)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; color: #1f2a30; background: #faf5ec; }
      header, section { margin-bottom: 24px; }
      h1, h2, h3 { font-family: Georgia, serif; }
      ul { padding-left: 20px; }
      article { border: 1px solid #d7c8b6; border-radius: 16px; padding: 16px; margin: 12px 0; background: #fff; }
      .summary { display: grid; gap: 8px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Stealth Lightbeacon Report</h1>
      <p>Evaluation ID: <code>${escapeHtml(evaluationId)}</code></p>
      <p>Status: ${escapeHtml(view.statusLabel)}</p>
    </header>
    <section>
      <h2>Summary</h2>
      <ul class="summary">${summaryItems}</ul>
    </section>
    <section>
      <h2>Findings</h2>
      ${findingItems}
    </section>
    <section>
      <h2>Artifacts</h2>
      ${artifactItems}
    </section>
  </body>
</html>`
}

export function buildEvaluationReportDownloads(
  evaluationId: string,
  result: EvaluationResultResponse,
  artifacts: ArtifactDescriptor[],
): ReportDownloadView[] {
  const markdown = buildReportMarkdown(evaluationId, result, artifacts)
  const html = buildReportHtml(evaluationId, result, artifacts)
  const json = JSON.stringify(
    {
      evaluationId,
      result,
      artifacts,
    },
    null,
    2,
  )

  return [
    {
      label: 'Download JSON report',
      filename: `${evaluationId}-report.json`,
      href: buildDataUrl('application/json', json),
    },
    {
      label: 'Download Markdown report',
      filename: `${evaluationId}-report.md`,
      href: buildDataUrl('text/markdown', markdown),
    },
    {
      label: 'Download HTML report',
      filename: `${evaluationId}-report.html`,
      href: buildDataUrl('text/html', html),
    },
  ]
}

function buildArtifactDownloadRows(artifacts: ArtifactDescriptor[]): ReportDownloadView[] {
  const seen = new Set<string>()
  const downloads: ReportDownloadView[] = []

  for (const artifact of artifacts) {
    if (!artifact.downloadUrl) {
      continue
    }

    const key = `${artifact.name}::${artifact.downloadUrl}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    downloads.push({
      label: artifact.name,
      filename: `${artifact.kind}.${artifact.mediaType}`,
      href: artifact.downloadUrl,
    })
  }

  return downloads
}

export function upsertEvaluationHistoryView(
  history: EvaluationHistoryView[],
  entry: EvaluationHistoryView,
): EvaluationHistoryView[] {
  return [entry, ...history.filter((item) => item.evaluationId !== entry.evaluationId)].slice(0, 5)
}

export function resultToneClass(status: string) {
  return status === 'success' ? 'tone-good' : 'tone-idle'
}

function App() {
  const desktopRuntime = isDesktopRuntime()
  const pollTimerRef = useRef<number | null>(null)
  const nextActivityIdRef = useRef(1)
  const initialViewport = readViewportState()

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
  const [connectionFailureCode, setConnectionFailureCode] =
    useState<ConnectionFailureCode>(null)
  const [request, setRequest] = useState<CreateEvaluationRequest>(defaultRequest)
  const [activeEvaluation, setActiveEvaluation] =
    useState<CreateEvaluationResponse | null>(null)
  const [evaluationStatus, setEvaluationStatus] =
    useState<EvaluationStatusResponse | null>(null)
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResultResponse | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactDescriptor[]>([])
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryView[]>([])
  const [resultLoadState, setResultLoadState] = useState<ResultLoadState>('idle')
  const [resultError, setResultError] = useState<string | null>(null)
  const [artifactsLoadState, setArtifactsLoadState] =
    useState<ResultLoadState>('idle')
  const [artifactsError, setArtifactsError] = useState<string | null>(null)
  const [reconResult, setReconResult] = useState<ReconResponse | null>(null)
  const [reconLoadState, setReconLoadState] =
    useState<ReconLoadState>('idle')
  const [reconError, setReconError] = useState<string | null>(null)
  const reconRequestVersionRef = useRef(0)
  const evaluationStatusRef = useRef<EvaluationStatusResponse | null>(null)
  const evaluationResultRef = useRef<EvaluationResultResponse | null>(null)
  const artifactsRef = useRef<ArtifactDescriptor[]>([])
  const [viewport, setViewport] = useState<ViewportState>(initialViewport)
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTabKey>('overview')
  const [traceExpanded, setTraceExpanded] = useState(
    initialViewport.density !== 'compact',
  )
  const [reportExpanded, setReportExpanded] = useState(
    initialViewport.density !== 'compact',
  )
  const [reportsLinksExpanded, setReportsLinksExpanded] = useState(true)
  const [seoScope, setSeoScope] = useState<'current' | 'sitewide'>('current')
  const [performanceMode, setPerformanceMode] = useState<'field' | 'lab'>('lab')
  const [pollingPaused, setPollingPaused] = useState(false)
  const [pollFailureCount, setPollFailureCount] = useState(0)
  const [pollError, setPollError] = useState<string | null>(null)
  const [pollRestartToken, setPollRestartToken] = useState(0)
  const [shouldPollActiveEvaluation, setShouldPollActiveEvaluation] = useState(false)
  const [snapshotPersistedForEvaluationId, setSnapshotPersistedForEvaluationId] =
    useState<string | null>(null)
  const [uiSettings, setUiSettings] = useState<UiSettings>(loadUiSettings)
  const [notice, setNotice] = useState(
    'Standalone engine is ready by default. Confirm health, then submit an audit run.',
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

  useEffect(() => {
    try {
      getUiStorage()?.setItem(uiSettingsStorageKey, JSON.stringify(uiSettings))
    } catch {
      // Ignore persistence failures in preview or sandboxed contexts.
    }
  }, [uiSettings])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewport = () => {
      setViewport(readViewportState())
    }

    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('resize', updateViewport)
    }
  }, [])

  useEffect(() => {
    evaluationStatusRef.current = evaluationStatus
  }, [evaluationStatus])

  useEffect(() => {
    evaluationResultRef.current = evaluationResult
  }, [evaluationResult])

  useEffect(() => {
    artifactsRef.current = artifacts
  }, [artifacts])

  const updateUiColor = useCallback((key: UiThemeKey, value: string) => {
    setUiSettings((current) => ({
      ...current,
      theme: {
        ...current.theme,
        [key]: value,
      },
    }))
  }, [])

  const toggleUiSection = useCallback((key: UiSectionKey, enabled: boolean) => {
    setUiSettings((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [key]: enabled,
      },
    }))
  }, [])

  const updateWorkspaceSize = useCallback((workspaceSize: WorkspaceSizeKey) => {
    setUiSettings((current) => ({
      ...current,
      workspaceSize,
    }))
  }, [])

  const updateFontScale = useCallback((fontScale: number) => {
    setUiSettings((current) => ({
      ...current,
      fontScale,
    }))
  }, [])

  const updateApiTabEnabled = useCallback((apiTabEnabled: boolean) => {
    setUiSettings((current) => ({
      ...current,
      apiTabEnabled,
    }))
    if (!apiTabEnabled) {
      setActiveWorkspaceTab((current) =>
        current === 'connection' ? 'overview' : current,
      )
    }
  }, [])

  const resetUiSettings = useCallback(() => {
    setUiSettings(defaultUiSettings)
  }, [])

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const resetReconOutput = useCallback(
    (nextLoadState: ReconLoadState = 'idle', nextError: string | null = null) => {
      reconRequestVersionRef.current += 1
      startTransition(() => {
        setReconResult(null)
        setReconError(nextError)
        setReconLoadState(nextLoadState)
      })
    },
    [],
  )

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
    resetReconOutput()

    if (!desktopRuntime) {
      startTransition(() => {
        setHealth(null)
        setCapabilities(null)
        setCapabilitiesLoadState('idle')
        setNotice(
          'Desktop commands are unavailable in browser preview. Launch `pnpm run tauri:dev` to connect to the backend API.',
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
          setConnectionFailureCode(null)
          setNotice(
            nextHealthResult.value.authRequired
              ? `${nextHealthResult.value.service} is reachable, but remote auth is required before protected capabilities can load.`
              : `${nextHealthResult.value.service} is reachable. Create an evaluation to begin polling backend job state.`,
          )
          setStatusLine(
            nextHealthResult.value.authRequired
              ? `${formatBackendMode(mode)} / auth required`
              : `${formatBackendMode(mode)} / ${nextHealthResult.value.apiVersion}`,
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
      const nextFailureCode =
        nextCapabilitiesResult.status === 'rejected'
          ? classifyConnectionFailure(nextCapabilitiesResult.reason)
          : null
      const nextNotice =
        nextFailureCode === 'unauthorized'
          ? 'Remote auth required. Set the backend auth token before loading protected capabilities.'
          : nextFailureCode === 'incompatible_client'
            ? `Desktop version is not supported by this backend. ${nextHealthResult.status === 'fulfilled' && nextHealthResult.value.compatibility
                ? `Minimum ${nextHealthResult.value.compatibility.minimumDesktopVersion}, recommended ${nextHealthResult.value.compatibility.recommendedDesktopVersion}.`
                : 'Update the desktop client before loading protected capabilities.'}`
            : capabilitiesMessage
              ? `Capabilities unavailable. ${capabilitiesMessage}`
              : healthMessage ?? 'Backend unavailable.'
      const nextStatusLine =
        nextHealthResult.status === 'fulfilled'
          ? nextFailureCode === 'unauthorized'
            ? `${formatBackendMode(mode)} / auth required`
            : nextFailureCode === 'incompatible_client'
              ? `${formatBackendMode(mode)} / compatibility mismatch`
              : capabilitiesMessage
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
        setConnectionFailureCode(nextFailureCode)
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
      const failureCode = classifyConnectionFailure(error)
      startTransition(() => {
        setHealth(null)
        setCapabilities(null)
        setCapabilitiesLoadState('failed')
        setConnectionFailureCode(failureCode)
        setNotice(message)
        setStatusLine('Backend unavailable')
      })
      recordActivity('Backend connection failed', message)
    } finally {
      setRefreshingConnection(false)
    }
  }, [desktopRuntime, recordActivity, resetReconOutput, syncProfilesFromCapabilities])

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
            setEvaluationHistory([
              buildEvaluationHistoryView(
                snapshot.evaluation,
                snapshot.evaluationStatus,
                snapshot.evaluationResult,
                snapshot.artifacts,
              ),
            ])
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
          setEvaluationHistory((current) => {
            if (!activeEvaluation) {
              return current
            }

            return upsertEvaluationHistoryView(
              current,
              buildEvaluationHistoryView(
                activeEvaluation,
                evaluationStatusRef.current,
                nextResult,
                artifactsRef.current,
              ),
            )
          })
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
    // Loading state flips inside this effect; depending on it cancels the in-flight request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeEvaluation?.evaluationId,
    desktopRuntime,
    evaluationStatus?.terminal,
    recordActivity,
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
          setEvaluationHistory((current) => {
            if (!activeEvaluation) {
              return current
            }

            return upsertEvaluationHistoryView(
              current,
              buildEvaluationHistoryView(
                activeEvaluation,
                evaluationStatusRef.current,
                evaluationResultRef.current,
                nextArtifacts,
              ),
            )
          })
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
    // Loading state flips inside this effect; depending on it cancels the in-flight request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeEvaluation?.evaluationId,
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
        'Desktop commands are unavailable in browser preview. Launch `pnpm run tauri:dev` to save backend settings.',
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
        'Desktop commands are unavailable in browser preview. Launch `pnpm run tauri:dev` to submit an evaluation.',
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
        setEvaluationHistory((current) =>
          upsertEvaluationHistoryView(
            current,
            buildEvaluationHistoryView(
              accepted,
              {
                evaluationId: accepted.evaluationId,
                status: accepted.status,
                stage: 'queued',
                progressPercent: 0,
                message: 'Evaluation accepted by backend.',
                exitState: null,
                terminal: false,
              },
              null,
              [],
            ),
          ),
        )
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

  async function handleRunRecon() {
    if (!desktopRuntime) {
      setNotice(
        'Desktop commands are unavailable in browser preview. Launch `pnpm run tauri:dev` to run recon.',
      )
      setStatusLine('Preview mode')
      return
    }

    reconRequestVersionRef.current += 1
    const reconRequestVersion = reconRequestVersionRef.current
    const reconValidationErrors: string[] = []
    const nextTarget = request.target.trim()

    if (!nextTarget) {
      reconValidationErrors.push('Enter a target URL before running recon.')
    }

    if (!health) {
      reconValidationErrors.push('Restore backend connectivity before running recon.')
    }

    if (capabilitiesLoadState !== 'ready') {
      reconValidationErrors.push('Load backend capabilities before running recon.')
    }

    if (capabilitiesLoadState === 'ready' && !capabilities?.supportsRecon) {
      reconValidationErrors.push('Load a backend that supports recon before running recon.')
    }

    if (reconValidationErrors.length > 0) {
      const message = reconValidationErrors[0]
      resetReconOutput('failed', message)
      startTransition(() => {
        setNotice(message)
        setStatusLine('Recon blocked')
      })
      recordActivity('Recon blocked', message)
      return
    }

    startTransition(() => {
      setReconLoadState('loading')
      setReconError(null)
    })

    try {
      const nextRecon = await runRecon({ target: nextTarget })
      if (reconRequestVersion !== reconRequestVersionRef.current) {
        return
      }

      startTransition(() => {
        setReconResult(nextRecon)
        setReconLoadState('ready')
        setReconError(null)
        setNotice(`Recon completed for ${nextRecon.target}.`)
        setStatusLine(`Recon ready for ${nextRecon.target}`)
      })
      recordActivity(
        'Recon completed',
        `${nextRecon.target} returned ${nextRecon.posture} posture at ${formatConfidence(nextRecon.confidence)} confidence.`,
      )
    } catch (error) {
      if (reconRequestVersion !== reconRequestVersionRef.current) {
        return
      }

      const message = formatCommandError(error)
      resetReconOutput('failed', message)
      startTransition(() => {
        setNotice(message)
        setStatusLine('Recon unavailable')
      })
      recordActivity('Recon failed', message)
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
  const reconResultView = reconResult ? buildReconResultView(reconResult) : null
  const artifactDownloadRows = buildArtifactDownloadRows(artifacts)
  const remoteDraftMode = draftConfig.mode === 'remote'
  const reportAvailable = Boolean(evaluationStatus?.terminal)
  const shellStyle = buildUiShellStyle(uiSettings)
  const workspaceLayout = resolveWorkspaceLayout(uiSettings, viewport)
  const showRecentActivity = uiSettings.sections.recentActivity
  const showCurrentEvaluation = uiSettings.sections.currentEvaluation
  const showTerminalReport = uiSettings.sections.terminalReport
  const showBackendSurface = uiSettings.sections.backendSurface
  const visibleWorkspaceTabs = useMemo(
    () =>
      uiSettings.apiTabEnabled
        ? workspaceTabs
        : workspaceTabs.filter((tab) => tab.key !== 'connection'),
    [uiSettings.apiTabEnabled],
  )
  const visibleEvaluationHistory = evaluationHistory.filter((item) => item.evaluationId)
  const scoreMetric = terminalResultView?.summaryMetrics[0]?.value ?? '85'
  const parsedScore = Number.parseInt(scoreMetric, 10)
  const hubScore = Number.isFinite(parsedScore) ? parsedScore : 85
  const accessibilityFindings = terminalResultView?.findings.slice(0, 3) ?? []
  const seoScore = Math.min(100, Math.max(0, hubScore + 7))
  const aeoScore = Math.min(100, Math.max(0, hubScore - 20))
  const performanceScore = Math.min(100, Math.max(0, hubScore - 20))
  const lcpMetric = performanceMode === 'lab' ? '2.9s' : '2.5s'
  const tbtMetric = performanceMode === 'lab' ? '350ms' : '280ms'
  const modeOperationsCopy =
    backendConfig.mode === 'standalone'
      ? 'Embedded SEO, GEO, AEO, and WCAG 2.1/2.2 AA rules run inside the desktop boundary.'
      : backendConfig.mode === 'local'
        ? 'The desktop process supervises a loopback companion while keeping configuration and results inside Tauri.'
        : 'The desktop shell brokers remote HTTPS requests while preserving desktop-side validation and caching.'
  const workspaceDensityLabel = workspaceLayout.label
  const workspaceSizeLabel = `${workspaceLayout.width} x ${workspaceLayout.height}`
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
  const reconCanRun =
    desktopRuntime &&
    reconLoadState !== 'loading' &&
    request.target.trim().length > 0 &&
    health !== null &&
    capabilitiesLoadState === 'ready' &&
    capabilities?.supportsRecon === true

  return (
    <div
      className={`app-shell app-shell--${workspaceLayout.density}`}
      style={shellStyle}
      data-viewport-density={viewport.density}
      data-workspace-size={workspaceLayout.key}
    >
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
              Standalone SEO, GEO, AEO, and WCAG-guided audit runs from the
              desktop shell.
            </p>
          </div>
        </div>

        <div className="topbar-meta">
          <div className="meta-block">
            <span className="meta-label">Engine</span>
            <strong>
              {backendConfig.mode === 'standalone'
                ? 'Standalone'
                : formatBackendMode(backendConfig.mode)}
            </strong>
          </div>
          <div className="meta-block">
            <span className="meta-label">Readiness</span>
            <strong>{summarizeHealth(health)}</strong>
          </div>
          <div className="meta-block">
            <span className="meta-label">Viewport</span>
            <strong>
              {workspaceDensityLabel} · {workspaceSizeLabel}
            </strong>
          </div>
        </div>
      </header>

      <nav className="workspace-tabs" role="tablist" aria-label="Workspace panels">
        {visibleWorkspaceTabs.map((tab) => {
          const selected = activeWorkspaceTab === tab.key
          return (
            <button
              key={tab.key}
              id={`workspace-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`workspace-panel-${tab.key}`}
              className={`workspace-tab${selected ? ' workspace-tab--active' : ''}`}
              onClick={() => setActiveWorkspaceTab(tab.key)}
            >
              <span>{tab.label}</span>
              <small>{tab.description}</small>
            </button>
          )
        })}
      </nav>

      <main className="workspace-panels">
        <section
          id="workspace-panel-overview"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-overview"
          hidden={activeWorkspaceTab !== 'overview'}
        >
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Execution Modes</p>
              <h2>Run standalone audits from the desktop shell.</h2>
            </div>
            <span className="status-pill status-live">
              {workspaceLayout.density === 'compact'
                ? 'Dense shell'
                : workspaceLayout.density === 'balanced'
                  ? 'Balanced shell'
                  : 'Wide shell'}
            </span>
          </div>

          <div className="hero-panel hero-panel--tabbed">
            <div className="hero-copy">
              <p className="hero-text">
                The Tauri layer stores connection state, coordinates evaluation
                lifecycle, and ships an embedded ruleset for SEO, GEO, AEO,
                and WCAG 2.1/2.2 AA coverage without requiring an API setup.
              </p>
              <div className="notice-bar notice-bar--compact">
                <div>
                  <span className="notice-label">Execution path</span>
                  <p>{modeOperationsCopy}</p>
                </div>
                <strong>{backendConfig.mode === 'standalone' ? 'Embedded' : backendConfig.baseUrl}</strong>
              </div>
            </div>

            <div className="hero-metrics">
              <article className="metric-card">
                <span className="metric-label">Engine target</span>
                <strong>{backendConfig.mode === 'standalone' ? 'Embedded ruleset' : backendConfig.baseUrl}</strong>
                <p>
                  {backendConfig.mode === 'standalone'
                    ? 'Standalone-first runs stay inside the desktop boundary.'
                    : backendConfig.mode === 'remote'
                    ? `Remote HTTPS endpoint on port ${backendConfig.port}.`
                    : `Loopback default port ${backendConfig.port} is configurable.`}
                </p>
              </article>
              <article className="metric-card">
                <span className="metric-label">Audit coverage</span>
                <strong>SEO / GEO / AEO / WCAG AA</strong>
                <p>
                  Embedded capability profiles keep accessibility checks aligned
                  with search-facing analysis.
                </p>
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
              <article className="metric-card">
                <span className="metric-label">Window size</span>
                <strong>{workspaceSizeLabel}</strong>
                <p>{workspaceDensityLabel} layout defaults keep the shell compact.</p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="workspace-panel-connection"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-connection"
          hidden={activeWorkspaceTab !== 'connection'}
        >
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
              <input type="text" value={health?.apiVersion ?? 'Unreachable'} readOnly />
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

          {showBackendSurface ? (
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
                  <strong className={capabilities?.supportsArtifacts ? 'tone-good' : 'tone-warn'}>
                    {capabilities?.supportsArtifacts ? 'Supported' : 'Deferred'}
                  </strong>
                </div>
                <p>Phase 2 consumes artifact routes without moving persistence into the client.</p>
              </article>
              <article className="validation-card">
                <div className="validation-header">
                  <span>Recon</span>
                  <strong className={capabilities?.supportsRecon ? 'tone-good' : 'tone-warn'}>
                    {capabilities?.supportsRecon ? 'Available' : 'Unavailable'}
                  </strong>
                </div>
                <p>
                  {capabilities?.supportsRecon
                    ? 'Recon runs from the Audit tab against the active target.'
                    : 'Load a backend that exposes the recon route before using this workflow.'}
                </p>
              </article>
              <article className="validation-card">
                <div className="validation-header">
                  <span>Auth</span>
                  <strong className={health?.authRequired ? 'tone-warn' : 'tone-good'}>
                    {health?.authRequired ? 'Required' : 'Not required'}
                  </strong>
                </div>
                <p>
                  {health?.authRequired
                    ? 'Protected capabilities require the backend auth token before they can load.'
                    : 'Backend capabilities load without an auth token in this mode.'}
                </p>
              </article>
              <article className="validation-card">
                <div className="validation-header">
                  <span>Compatibility</span>
                  <strong className={connectionFailureCode === 'incompatible_client' ? 'tone-warn' : 'tone-good'}>
                    {health?.compatibility?.minimumDesktopVersion
                      ? `${health.compatibility.minimumDesktopVersion}+`
                      : 'Unavailable'}
                  </strong>
                </div>
                <p>
                  {health?.compatibility
                    ? `Recommended ${health.compatibility.recommendedDesktopVersion}. ${
                        connectionFailureCode === 'incompatible_client'
                          ? 'The backend rejected this desktop version.'
                          : 'Match the backend minimum before loading protected capabilities.'
                      }`
                    : 'Compatibility guidance appears after health loads.'}
                </p>
              </article>
            </div>
          ) : (
            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Backend surface</span>
                  <strong className="tone-idle">Hidden</strong>
                </div>
                <p>Backend surface details are disabled in Settings.</p>
              </article>
            </div>
          )}
        </section>

        <section
          id="workspace-panel-audit"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-audit"
          hidden={activeWorkspaceTab !== 'audit'}
        >
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
                onChange={(event) => {
                  const nextTarget = event.target.value
                  resetReconOutput()
                  setRequest((current) => ({
                    ...current,
                    target: nextTarget,
                  }))
                }}
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
                            ? current.outputFormats.filter((item) => item !== format)
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

          <div className="subsection-heading">
            <div>
              <p className="section-kicker">Recon advisory</p>
              <h3>Target posture and transport hints</h3>
            </div>
            <button
              type="button"
              className="secondary-action"
              disabled={!reconCanRun}
              onClick={() => void handleRunRecon()}
            >
              {reconLoadState === 'loading' ? 'Running Recon' : 'Run Recon'}
            </button>
          </div>

          <div className="validation-list">
            <article className="validation-card">
              <div className="validation-header">
                <span>Recon target</span>
                <strong className="tone-idle">{request.target.trim() || 'Unset'}</strong>
              </div>
              <p>
                {reconCanRun
                  ? 'Run recon to derive an operator posture recommendation for the active target.'
                  : 'Reconnect capabilities and choose a target before running recon.'}
              </p>
            </article>

            <article className="validation-card">
              <div className="validation-header">
                <span>Recon state</span>
                <strong
                  className={
                    reconLoadState === 'ready'
                      ? 'tone-good'
                      : reconLoadState === 'failed'
                        ? 'tone-warn'
                        : 'tone-idle'
                  }
                >
                  {reconLoadState === 'loading'
                    ? 'Loading'
                    : reconLoadState === 'ready'
                      ? 'Ready'
                      : reconLoadState === 'failed'
                        ? 'Blocked'
                        : 'Idle'}
                </strong>
              </div>
              <p>
                {reconError
                  ? reconError
                  : reconLoadState === 'ready'
                    ? 'Recon output is ready below.'
                    : 'Recon output appears after the backend returns a recommendation.'}
              </p>
            </article>
          </div>

          {reconResultView ? (
            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Recommendation</span>
                  <strong className="tone-good">{reconResultView.recommendation}</strong>
                </div>
                <p>{reconResultView.evidenceSummary}</p>
              </article>

              <article className="validation-card">
                <div className="validation-header">
                  <span>Posture</span>
                  <strong className="tone-idle">{reconResultView.posture}</strong>
                </div>
                <p>
                  Confidence {reconResultView.confidenceLabel} · Auto-select{' '}
                  {reconResultView.autoSelectAllowed}
                </p>
              </article>

              {reconResultView.signals.length ? (
                <article className="validation-card">
                  <div className="validation-header">
                    <span>Signals</span>
                    <strong className="tone-idle">{reconResultView.signals.length}</strong>
                  </div>
                  <p>{reconResultView.signals.join(', ')}</p>
                </article>
              ) : null}

              {reconResultView.evidence.length ? (
                <article className="validation-card">
                  <div className="validation-header">
                    <span>Evidence</span>
                    <strong className="tone-idle">{reconResultView.evidence.length}</strong>
                  </div>
                  <p>{reconResultView.evidence.join(', ')}</p>
                </article>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          id="workspace-panel-results"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-results"
          hidden={activeWorkspaceTab !== 'results'}
        >
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Status</p>
              <h2>Current Evaluation</h2>
            </div>
            <span className="status-pill status-soft">
              {evaluationStatus?.terminal ? 'Terminal' : 'Polling'}
            </span>
          </div>

          {showCurrentEvaluation ? (
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
          ) : (
            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Status</span>
                  <strong className="tone-idle">Hidden</strong>
                </div>
                <p>Current evaluation cards are disabled in Settings.</p>
              </article>
            </div>
          )}

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

          {showTerminalReport ? (
            <>
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
                    <p>
                      Terminal reports and artifact descriptors appear once the active audit reaches a terminal state.
                    </p>
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
                    <article
                      key={`${artifact.kind}-${artifact.name}`}
                      className="validation-card"
                    >
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

              {visibleEvaluationHistory.length ? (
                <div className="history-section">
                  <div className="subsection-heading">
                    <div>
                      <p className="section-kicker">Run history</p>
                      <h3>Recent Evaluations</h3>
                    </div>
                    <span className="status-pill status-muted">
                      {visibleEvaluationHistory.length} cached
                    </span>
                  </div>

                  <div className="history-grid">
                    {visibleEvaluationHistory.map((entry) => (
                      <article key={entry.evaluationId} className="history-card">
                        <div className="validation-header">
                          <span>{entry.evaluationId}</span>
                          <strong className={entry.resultLabel === 'success' ? 'tone-good' : 'tone-idle'}>
                            {entry.statusLabel}
                          </strong>
                        </div>
                        <p>{entry.detailLabel}</p>
                        <p>
                          {entry.acceptedAt ? `Accepted ${entry.acceptedAt}` : 'Accepted time unavailable'}
                        </p>
                        <p>
                          {entry.stageLabel ? `${entry.stageLabel} · ` : ''}
                          {entry.scoreLabel ?? 'Score unavailable'} · {entry.artifactCount} artifacts
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

            </>
          ) : (
            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Reporting</span>
                  <strong className="tone-idle">Hidden</strong>
                </div>
                <p>Terminal reporting and artifact cards are disabled in Settings.</p>
              </article>
            </div>
          )}
        </section>

        <section
          id="workspace-panel-activity"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-activity"
          hidden={activeWorkspaceTab !== 'activity'}
        >
          <div className="companion-sidebar" aria-label="Optimization hub sidebar">
            <div className="companion-sidebar-header">
              <h3>🌐 The Web Companion: Optimization Hub</h3>
              <span aria-hidden="true">⚙️</span>
            </div>

            <section className="companion-section">
              <div className="companion-section-title">♿️ 📋 WCAG 2.1/2.2 AA Accessibility Audit</div>
              <div className="companion-score-row">
                <div className="companion-score-gauge">
                  <strong>{hubScore}</strong>
                  <small>/100</small>
                </div>
                <div>
                  <span className="status-pill status-live">Overall Score</span>
                  <p>Good</p>
                </div>
              </div>
              <button
                type="button"
                className="primary-action companion-run-button"
                onClick={() => setActiveWorkspaceTab('audit')}
              >
                Run Full Audit
              </button>
              <p className="section-kicker">Findings</p>
              <ul className="companion-list">
                {accessibilityFindings.length ? (
                  accessibilityFindings.map((finding) => (
                    <li key={finding.key}>
                      <span aria-hidden="true">•</span>
                      <span>{finding.title}</span>
                    </li>
                  ))
                ) : (
                  <li>
                    <span aria-hidden="true">•</span>
                    <span>No accessibility findings yet.</span>
                  </li>
                )}
              </ul>
            </section>

            <section className="companion-section">
              <div className="companion-section-title">🔍 🌐 🅰️ SEO, GEO & AEO Performance</div>
              <div className="companion-tab-row">
                <button
                  type="button"
                  className={seoScope === 'current' ? 'companion-tab companion-tab--active' : 'companion-tab'}
                  onClick={() => setSeoScope('current')}
                >
                  Current Page
                </button>
                <button
                  type="button"
                  className={seoScope === 'sitewide' ? 'companion-tab companion-tab--active' : 'companion-tab'}
                  onClick={() => setSeoScope('sitewide')}
                >
                  Site-Wide
                </button>
              </div>
              <div className="companion-metrics">
                <p><strong>On-Page SEO:</strong> {seoScore}/100</p>
                <p><strong>Schema Markup:</strong> Found ({Math.max(1, artifacts.length)} entities)</p>
                <p><strong>Answer Engine Optimization (AEO):</strong> {aeoScore}/100</p>
                <p><strong>Geographic SEO:</strong> {seoScope === 'sitewide' ? 'Regional profile required' : 'N/A (set service areas)'}</p>
              </div>
            </section>

            <section className="companion-section">
              <div className="companion-section-title">🔒 💧 Security & Drupal Review</div>
              <p><strong>General Site Security:</strong> High</p>
              <ul className="companion-list">
                <li><span aria-hidden="true">•</span><span>Content-Security-Policy: Missing</span></li>
                <li><span aria-hidden="true">•</span><span>X-Frame-Options: SAMEORIGIN</span></li>
                <li><span aria-hidden="true">•</span><span>Strict-Transport-Security: Enabled</span></li>
              </ul>
            </section>

            <section className="companion-section">
              <div className="companion-section-title">⏱️ 🚀 Page Performance Metrics</div>
              <div className="companion-score-row">
                <div className="companion-score-gauge companion-score-gauge--warn">
                  <strong>{performanceScore}</strong>
                  <small>/100</small>
                </div>
                <div>
                  <span className="status-pill status-soft">Overall Score</span>
                  <p>Needs Improvement</p>
                </div>
              </div>
              <ul className="companion-list">
                <li><span aria-hidden="true">•</span><span>Largest Contentful Paint (LCP): {lcpMetric}</span></li>
                <li><span aria-hidden="true">•</span><span>Cumulative Layout Shift (CLS): 0.05</span></li>
                <li><span aria-hidden="true">•</span><span>Total Blocking Time (TBT): {tbtMetric}</span></li>
              </ul>
              <div className="companion-toggle">
                <span>Field Data</span>
                <button
                  type="button"
                  className={performanceMode === 'lab' ? 'companion-switch companion-switch--active' : 'companion-switch'}
                  onClick={() =>
                    setPerformanceMode((current) => (current === 'lab' ? 'field' : 'lab'))
                  }
                  aria-label="Toggle performance data mode"
                >
                  <span />
                </button>
                <span>Lab Data</span>
              </div>
            </section>
          </div>

          <div className="panel-heading">
            <div>
              <p className="section-kicker">Reports</p>
              <h2>Reporting Operations</h2>
            </div>
            <div className="heading-actions">
              <span className="status-pill status-muted">Last four events</span>
              {showRecentActivity ? (
                <button
                  type="button"
                  className="collapse-toggle"
                  aria-expanded={traceExpanded}
                  aria-controls="trace-panel"
                  onClick={() => setTraceExpanded((current) => !current)}
                >
                  {traceExpanded ? 'Collapse trace' : 'Expand trace'}
                </button>
              ) : null}
            </div>
          </div>

          {showRecentActivity ? (
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
          ) : (
            <div className="validation-list">
              <article className="validation-card">
                <div className="validation-header">
                  <span>Trace</span>
                  <strong className="tone-idle">Hidden</strong>
                </div>
                <p>Recent activity is disabled in Settings.</p>
              </article>
            </div>
          )}

          <div className="history-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Downloads</p>
                <h3>Report Links</h3>
              </div>
              <button
                type="button"
                className="collapse-toggle"
                aria-expanded={reportsLinksExpanded}
                aria-controls="reports-links-panel"
                onClick={() => setReportsLinksExpanded((current) => !current)}
              >
                {reportsLinksExpanded ? 'Collapse report links' : 'Expand report links'}
              </button>
            </div>
            <div
              id="reports-links-panel"
              className="table-scroll"
              hidden={!reportsLinksExpanded}
            >
              <table className="reports-download-table" aria-label="Report downloads">
                <thead>
                  <tr>
                    <th scope="col">Report</th>
                    <th scope="col">Filename</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {artifactDownloadRows.length ? (
                    artifactDownloadRows.map((download) => (
                      <tr key={download.href}>
                        <td>{download.label}</td>
                        <td>{download.filename}</td>
                        <td>
                          <a href={download.href} target="_blank" rel="noreferrer">
                            {`Download ${download.label}`}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>No report downloads available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          id="workspace-panel-settings"
          className="panel workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-settings"
          hidden={activeWorkspaceTab !== 'settings'}
        >
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Operator preferences</p>
              <h2>Settings</h2>
            </div>
            <span className="status-pill status-muted">Persisted locally</span>
          </div>

          <section className="settings-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Screen size</p>
                <h3>Workspace presets</h3>
              </div>
            </div>
            <div className="toggle-grid settings-toggle-grid">
              {workspaceSizeOptions.map((option) => (
                <label key={option.key} className="toggle-card">
                  <input
                    type="radio"
                    name="workspace-size"
                    aria-label={option.label}
                    aria-describedby={`workspace-size-${option.key}-description`}
                    checked={uiSettings.workspaceSize === option.key}
                    onChange={() => updateWorkspaceSize(option.key)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small id={`workspace-size-${option.key}-description`}>
                      {option.description}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-hint">
              {workspaceLayout.key === 'auto'
                ? 'Auto detect follows the current screen size and keeps the shell compressed for the visible viewport.'
                : `${workspaceLayout.label} layout defaults keep the shell compact for ${workspaceLayout.width} x ${workspaceLayout.height}.`}
            </p>
          </section>

          <section className="settings-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Display</p>
                <h3>Text size</h3>
              </div>
              <span className="status-pill status-muted">
                {Math.round(uiSettings.fontScale * 100)}%
              </span>
            </div>
            <label className="field settings-field">
              <span>Shell text size</span>
              <input
                aria-label="Shell text size"
                type="range"
                min="0.55"
                max="1.15"
                step="0.05"
                value={uiSettings.fontScale}
                onChange={(event) => updateFontScale(Number(event.target.value))}
              />
              <small className="field-hint">
                Default is 65% for a compact standalone-first shell. Increase it
                when presenting or using a larger display.
              </small>
            </label>
            <label className="toggle-card settings-toggle-card">
              <input
                type="checkbox"
                aria-label="Enable API setup tab"
                checked={uiSettings.apiTabEnabled}
                onChange={(event) => updateApiTabEnabled(event.target.checked)}
              />
              <span>
                <strong>API setup tab</strong>
                <small>
                  Optional local companion or external API controls stay hidden
                  until explicitly enabled.
                </small>
              </span>
            </label>
          </section>

          <section className="settings-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Theme</p>
                <h3>Panel colors</h3>
              </div>
            </div>
            <div className="settings-grid">
              {uiThemeFields.map((field) => (
                <label key={field.key} className="field settings-field">
                  <span>{field.label}</span>
                  <input
                    aria-label={field.label}
                    type="color"
                    value={uiSettings.theme[field.key]}
                    onChange={(event) => updateUiColor(field.key, event.target.value)}
                  />
                  <small className="field-hint">{field.description}</small>
                </label>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Visibility</p>
                <h3>Optional sections</h3>
              </div>
            </div>
            <div className="toggle-grid settings-toggle-grid">
              {uiSectionFields.map((field) => (
                <label key={field.key} className="toggle-card">
                  <input
                    type="checkbox"
                    checked={uiSettings.sections[field.key]}
                    onChange={(event) =>
                      toggleUiSection(field.key, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{field.label}</strong>
                    <small>{field.description}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="action-row">
              <button
                type="button"
                className="secondary-action"
                onClick={resetUiSettings}
              >
                Restore defaults
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="subsection-heading">
              <div>
                <p className="section-kicker">Support</p>
                <h3>Report a bug</h3>
              </div>
            </div>
            <div className="support-card">
              <p>Send bug reports to pratik.saptarshi@outlook.com.</p>
              <a href="mailto:pratik.saptarshi@outlook.com?subject=Stealth%20Lightbeacon%20bug%20report">
                Report a bug
              </a>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

export default App
