import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { EvaluationTable } from '../components/EvaluationTable'
import { SettingsTab } from '../components/SettingsTab'
import type { ArtifactDescriptor, EvaluationStatusResponse } from '../lib/desktop'
import type { EvaluationResultView, HistoryEntry, ThemeField, SectionField, UiSettings, WorkspaceLayout } from '../App.types'

describe('EvaluationTable coverage hardening', () => {
  it('renders hidden reporting when terminal reporting is disabled', () => {
    render(
      <EvaluationTable
        showTerminalReport={false}
        reportAvailable={false}
        reportExpanded={false}
        setReportExpanded={vi.fn()}
        evaluationStatus={null}
        evaluationResult={null}
        resultLoadState="idle"
        resultError={null}
        terminalResultView={null}
        artifactsLoadState="idle"
        artifactsError={null}
        artifacts={[]}
        visibleEvaluationHistory={[]}
        resultToneClass={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Terminal reporting and artifact cards are disabled in Settings.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /expand reporting/i })).not.toBeInTheDocument()
  })

  it('renders non-terminal and waiting states', () => {
    render(
      <EvaluationTable
        showTerminalReport={true}
        reportAvailable={false}
        reportExpanded={false}
        setReportExpanded={vi.fn()}
        evaluationStatus={null}
        evaluationResult={null}
        resultLoadState="loading"
        resultError={null}
        terminalResultView={null}
        artifactsLoadState="loading"
        artifactsError={null}
        artifacts={[]}
        visibleEvaluationHistory={[]}
        resultToneClass={vi.fn(() => 'tone-idle')}
      />,
    )

    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText(/once the active audit reaches a terminal state/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /expand reporting/i }),
    ).toBeInTheDocument()
  })

  it('covers terminal report loading and no-result branch', () => {
    const status: EvaluationStatusResponse = {
      evaluationId: 'eval-wait',
      status: 'running',
      stage: 'analysis',
      progressPercent: 10,
      message: 'Still running...',
      terminal: true,
    }

    render(
      <EvaluationTable
        showTerminalReport={true}
        reportAvailable={true}
        reportExpanded={false}
        setReportExpanded={vi.fn()}
        evaluationStatus={status}
        evaluationResult={null}
        resultLoadState="loading"
        resultError={null}
        terminalResultView={null}
        artifactsLoadState="loading"
        artifactsError={null}
        artifacts={[]}
        visibleEvaluationHistory={[]}
        resultToneClass={vi.fn(() => 'tone-idle')}
      />,
    )

    expect(screen.getByText('Terminal report')).toBeInTheDocument()
    expect(screen.getByText('Fetching terminal result from GET /evaluations/{evaluation_id}/result.')).toBeInTheDocument()
  })

  it('covers terminal-result digest with findings, artifacts, and history branches', () => {
    const status: EvaluationStatusResponse = {
      evaluationId: 'eval-done',
      status: 'success',
      stage: 'completed',
      progressPercent: 100,
      terminal: true,
    }

    const terminalResultView: EvaluationResultView = {
      statusLabel: 'success',
      summaryMetrics: [
        { label: 'Score', value: '91' },
        { label: 'Passed', value: '9' },
      ],
      severityItems: ['medium 1'],
      timelineMetrics: [
        { label: 'Started', value: '2026-01-01T00:00:00Z' },
        { label: 'Completed', value: '2026-01-01T00:00:03Z' },
      ],
      findings: [
        { key: 'a', title: 'Finding A', meta: 'medium / warn', description: 'desc a' },
        { key: 'b', title: 'Finding B', meta: 'low / pass', description: 'desc b' },
        { key: 'c', title: 'Finding C', meta: 'high / fail', description: 'desc c' },
        { key: 'd', title: 'Finding D', meta: 'info / pass', description: 'desc d' },
        { key: 'e', title: 'Finding E', meta: 'critical / fail', description: 'desc e' },
      ],
    }

    const artifacts: ArtifactDescriptor[] = [
      {
        name: 'json-report',
        kind: 'json',
        mediaType: 'application/json',
        downloadUrl: 'https://example.com/eval-done.json',
      },
      {
        name: 'html-report',
        kind: 'html',
        mediaType: 'text/html',
        downloadUrl: null,
      },
    ]

    const history: HistoryEntry[] = [
      {
        evaluationId: 'eval-old',
        acceptedAt: '2026-01-01T00:00:00Z',
        statusLabel: 'terminal',
        stageLabel: 'completed',
        resultLabel: 'success',
        scoreLabel: '91',
        artifactCount: 2,
        detailLabel: 'Cached snapshot available.',
      },
      {
        evaluationId: 'eval-none',
        acceptedAt: null,
        statusLabel: 'failed',
        stageLabel: null,
        resultLabel: null,
        scoreLabel: null,
        artifactCount: 0,
        detailLabel: 'No artifacts produced.',
      },
    ]

    render(
      <EvaluationTable
        showTerminalReport={true}
        reportAvailable={true}
        reportExpanded={true}
        setReportExpanded={vi.fn()}
        evaluationStatus={status}
        evaluationResult={{ evaluationId: 'eval-done', status: 'success', summary: {} }}
        resultLoadState="ready"
        resultError={null}
        terminalResultView={terminalResultView}
        artifactsLoadState="failed"
        artifactsError="service unavailable"
        artifacts={artifacts}
        visibleEvaluationHistory={history}
        resultToneClass={(statusValue) => `tone-${statusValue === 'success' ? 'good' : 'idle'}`}
      />,
    )

    expect(screen.getByText('Showing 4 of 5 findings from this run.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open json-report' })).toBeInTheDocument()
    expect(screen.getByText('Artifact retrieval failed. service unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open html-report' })).not.toBeInTheDocument()
    expect(screen.getByText('Accepted 2026-01-01T00:00:00Z')).toBeInTheDocument()
    expect(screen.getByText('Accepted time unavailable')).toBeInTheDocument()
    expect(screen.getByText('2 cached')).toBeInTheDocument()
  })

  it('covers panel visibility toggle and report collapsed branch', () => {
    function Harness() {
      const [reportExpanded, setReportExpanded] = useState(true)
      return (
        <EvaluationTable
          showTerminalReport={true}
          reportAvailable={true}
          reportExpanded={reportExpanded}
          setReportExpanded={setReportExpanded}
          evaluationStatus={{
            evaluationId: 'eval-1',
            status: 'accepted',
            terminal: false,
          }}
          evaluationResult={null}
          resultLoadState="failed"
          resultError="boom"
          terminalResultView={null}
          artifactsLoadState="ready"
          artifactsError={null}
          artifacts={[]}
          visibleEvaluationHistory={[]}
          resultToneClass={() => 'tone-idle'}
        />
      )
    }

    render(<Harness />)

    const toggle = screen.getByRole('button', { name: /collapse reporting/i })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SettingsTab coverage hardening', () => {
  const themeFields: ThemeField[] = [
    { key: 'panelBg', label: 'Panel background', description: 'Panel background color.' },
    { key: 'panelBorder', label: 'Panel border', description: 'Panel border color.' },
  ]

  const sectionFields: SectionField[] = [
    {
      key: 'recentActivity',
      label: 'Recent activity',
      description: 'Track recent workflow events.',
    },
    {
      key: 'currentEvaluation',
      label: 'Current evaluation',
      description: 'Show current evaluation metadata.',
    },
  ]

  const baseSettings: UiSettings = {
    theme: {
      panelBg: '#ffffff',
      panelBorder: '#cccccc',
      cardBg: '#101010',
      accent: '#00f',
      button: '#0f0',
    },
    sections: {
      recentActivity: true,
      currentEvaluation: true,
      terminalReport: true,
      backendSurface: false,
    },
    workspaceSize: 'auto',
    fontScale: 0.65,
    apiTabEnabled: false,
  }

  const workspaceSizeOptions = [
    { key: 'auto' as const, label: 'Compact', description: 'Compact density' },
    { key: 'laptop13' as const, label: 'Laptop 13', description: 'Laptop density' },
  ]

  it('renders settings tab and triggers core interaction callbacks', () => {
    const updateWorkspaceSize = vi.fn()
    const updateFontScale = vi.fn()
    const updateApiTabEnabled = vi.fn()
    const updateUiColor = vi.fn()
    const toggleUiSection = vi.fn()
    const resetUiSettings = vi.fn()

    render(
      <SettingsTab
        active={true}
        uiSettings={baseSettings}
        updateWorkspaceSize={updateWorkspaceSize}
        updateFontScale={updateFontScale}
        updateApiTabEnabled={updateApiTabEnabled}
        updateUiColor={updateUiColor}
        toggleUiSection={toggleUiSection}
        resetUiSettings={resetUiSettings}
        workspaceSizeOptions={workspaceSizeOptions}
        workspaceLayout={
          {
            key: 'auto',
            label: 'Auto',
            width: 1280,
            height: 720,
            density: 'compact',
          } as WorkspaceLayout
        }
        uiThemeFields={themeFields}
        uiSectionFields={sectionFields}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Laptop 13' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Shell text size' }), {
      target: { value: '0.75' },
    })
    const apiCheckbox = screen.getByRole('checkbox', { name: 'Enable API setup tab' })
    const allCheckboxes = screen.getAllByRole('checkbox')
    const sectionCheckboxes = allCheckboxes.filter((control) => control !== apiCheckbox)

    fireEvent.click(apiCheckbox)
    fireEvent.click(sectionCheckboxes[0])
    fireEvent.click(sectionCheckboxes[1])
    fireEvent.change(screen.getByLabelText('Panel background'), {
      target: { value: '#112233' },
    })
    fireEvent.change(screen.getByLabelText('Panel border'), {
      target: { value: '#445566' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }))

    expect(updateWorkspaceSize).toHaveBeenCalledWith('laptop13')
    expect(updateFontScale).toHaveBeenCalledWith(0.75)
    expect(updateApiTabEnabled).toHaveBeenCalledWith(true)
    expect(updateUiColor).toHaveBeenCalledWith('panelBg', '#112233')
    expect(updateUiColor).toHaveBeenCalledWith('panelBorder', '#445566')
    expect(toggleUiSection).toHaveBeenCalledWith('recentActivity', false)
    expect(toggleUiSection).toHaveBeenCalledWith('currentEvaluation', false)
    expect(resetUiSettings).toHaveBeenCalledTimes(1)

    expect(screen.getByText(/Auto detect follows the current screen size/)).toBeInTheDocument()
  })

  it('renders non-auto workspace hint and keeps panel hidden when inactive', () => {
    render(
      <SettingsTab
        active={false}
        uiSettings={baseSettings}
        updateWorkspaceSize={vi.fn()}
        updateFontScale={vi.fn()}
        updateApiTabEnabled={vi.fn()}
        updateUiColor={vi.fn()}
        toggleUiSection={vi.fn()}
        resetUiSettings={vi.fn()}
        workspaceSizeOptions={workspaceSizeOptions}
        workspaceLayout={{
          key: 'laptop13',
          label: 'Laptop 13',
          width: 1440,
          height: 960,
          density: 'balanced',
        }}
        uiThemeFields={themeFields}
        uiSectionFields={sectionFields}
      />,
    )

    const panel = document.getElementById('workspace-panel-settings') as HTMLElement
    expect(panel).toHaveAttribute('hidden')
    expect(
      screen.getByText('Laptop 13 layout defaults keep the shell compact for 1440 x 960.'),
    ).toBeInTheDocument()
  })
})
