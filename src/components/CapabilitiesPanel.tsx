import React from 'react'
import { HealthResponse, CapabilitiesResponse } from '../App.types'

interface CapabilitiesPanelProps {
  showBackendSurface: boolean
  health: HealthResponse | null
  availableProfiles: string[]
  capabilities: CapabilitiesResponse | null
  connectionFailureCode: string | null
}

export const CapabilitiesPanel: React.FC<CapabilitiesPanelProps> = ({
  showBackendSurface,
  health,
  availableProfiles,
  capabilities,
  connectionFailureCode,
}) => {
  if (!showBackendSurface) {
    return (
      <div className="validation-list">
        <article className="validation-card">
          <div className="validation-header">
            <span>Backend surface</span>
            <strong className="tone-idle">Hidden</strong>
          </div>
          <p>Backend surface details are disabled in Settings.</p>
        </article>
      </div>
    )
  }

  return (
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
  )
}
