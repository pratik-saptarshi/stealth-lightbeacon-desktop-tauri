import React from 'react'
import {
  EvaluationStatusResponse,
  EvaluationResultResponse,
  ArtifactDescriptor,
  EvaluationResultView,
  HistoryEntry,
} from '../App.types'

interface EvaluationTableProps {
  showTerminalReport: boolean
  reportExpanded: boolean
  reportAvailable: boolean
  setReportExpanded: React.Dispatch<React.SetStateAction<boolean>>
  evaluationStatus: EvaluationStatusResponse | null
  evaluationResult: EvaluationResultResponse | null
  resultLoadState: string
  resultError: string | null
  terminalResultView: EvaluationResultView | null
  artifactsLoadState: string
  artifactsError: string | null
  artifacts: ArtifactDescriptor[]
  visibleEvaluationHistory: HistoryEntry[]
  resultToneClass: (status: string) => string
}

export const EvaluationTable: React.FC<EvaluationTableProps> = ({
  showTerminalReport,
  reportExpanded,
  reportAvailable,
  setReportExpanded,
  evaluationStatus,
  evaluationResult,
  resultLoadState,
  resultError,
  terminalResultView,
  artifactsLoadState,
  artifactsError,
  artifacts,
  visibleEvaluationHistory,
  resultToneClass,
}) => {
  if (!showTerminalReport) {
    return (
      <div className="validation-list">
        <article className="validation-card">
          <div className="validation-header">
            <span>Reporting</span>
            <strong className="tone-idle">Hidden</strong>
          </div>
          <p>Terminal reporting and artifact cards are disabled in Settings.</p>
        </article>
      </div>
    )
  }

  return (
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

          {terminalResultView ? (
            <article className="validation-card report-digest-card">
              <div className="validation-header">
                <span>Report digest</span>
                <strong className={resultToneClass(evaluationResult?.status ?? '')}>
                  {terminalResultView.statusLabel}
                </strong>
              </div>

              <section className="report-digest-section">
                <h4>Summary</h4>
                <ul className="report-digest-list">
                  {terminalResultView.summaryMetrics.map((metric) => (
                    <li key={metric.label}>
                      <strong>{metric.label}</strong> {metric.value}
                    </li>
                  ))}
                  {terminalResultView.severityItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  {terminalResultView.timelineMetrics.map((metric) => (
                    <li key={metric.label}>
                      <strong>{metric.label}</strong> {metric.value}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="report-digest-section">
                <h4>Findings</h4>
                <div className="report-digest-findings">
                  {terminalResultView.findings.length ? (
                    terminalResultView.findings.slice(0, 4).map((finding) => (
                      <article key={finding.key} className="report-digest-finding">
                        <h5>{finding.title}</h5>
                        {finding.meta ? <p>{finding.meta}</p> : null}
                        {finding.description ? <p>{finding.description}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p>No findings reported.</p>
                  )}
                </div>
                {terminalResultView.findings.length > 4 ? (
                  <p className="report-digest-muted">
                    Showing 4 of {terminalResultView.findings.length} findings from this run.
                  </p>
                ) : null}
              </section>

              <section className="report-digest-section">
                <h4>Artifacts</h4>
                <p className="report-digest-muted">
                  {artifactsLoadState === 'loading'
                    ? 'Loading artifacts...'
                    : artifactsLoadState === 'failed'
                      ? `Artifact retrieval failed. ${artifactsError ?? 'Unknown desktop command error.'}`
                      : `${artifacts.length} artifact(s) loaded for this run.`}
                </p>
                <div className="report-digest-artifacts">
                  {artifacts.slice(0, 4).map((artifact) => (
                    <article
                      key={`${artifact.kind}-${artifact.name}`}
                      className="report-digest-artifact"
                    >
                      <h5>{artifact.name}</h5>
                      <p>
                        {artifact.kind} · {artifact.mediaType}
                      </p>
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
              </section>
            </article>
          ) : null}
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
  )
}
