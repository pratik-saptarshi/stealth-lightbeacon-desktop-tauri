import React from 'react'
import { UiSettings, WorkspaceSizeKey, WorkspaceLayout, ThemeField, SectionField } from '../App.types'

interface SettingsTabProps {
  active: boolean
  uiSettings: UiSettings
  updateWorkspaceSize: (size: WorkspaceSizeKey) => void
  updateFontScale: (scale: number) => void
  updateApiTabEnabled: (enabled: boolean) => void
  updateUiColor: (key: keyof UiSettings['theme'], color: string) => void
  toggleUiSection: (key: keyof UiSettings['sections'], enabled: boolean) => void
  resetUiSettings: () => void
  workspaceSizeOptions: { key: WorkspaceSizeKey; label: string; description: string }[]
  workspaceLayout: WorkspaceLayout
  uiThemeFields: ThemeField[]
  uiSectionFields: SectionField[]
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  active,
  uiSettings,
  updateWorkspaceSize,
  updateFontScale,
  updateApiTabEnabled,
  updateUiColor,
  toggleUiSection,
  resetUiSettings,
  workspaceSizeOptions,
  workspaceLayout,
  uiThemeFields,
  uiSectionFields,
}) => {
  return (
    <section
      id="workspace-panel-settings"
      className="panel workspace-panel"
      role="tabpanel"
      aria-labelledby="workspace-tab-settings"
      hidden={!active}
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
  )
}
