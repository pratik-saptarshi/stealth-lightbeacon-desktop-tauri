#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { JSDOM } from 'jsdom'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST_DIR = path.join(ROOT, 'dist')
const APP_VERSION = '0.1.0'
const DESKTOP_VERSION = '0.1.1'

const args = new Set(process.argv.slice(2))
const runSmoke = args.size === 0 || args.has('--smoke')
const runA11y = args.size === 0 || args.has('--axe')
// Pinned accessibility gate: axe-core is locked in package.json and this
// script is the desktop shell surface scanner used by validation lanes.

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function readBuiltBundlePath() {
  const assetDir = path.join(DIST_DIR, 'assets')
  const bundle = readdirSync(assetDir).find((file) => /^index-.*\.js$/.test(file))

  if (!bundle) {
    fail('validate-shell: unable to locate built index bundle under dist/assets')
  }

  return path.join(assetDir, bundle)
}

function installDomGlobals(window) {
  const bindings = {
    window,
    document: window.document,
    self: window,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    SVGElement: window.SVGElement,
    DOMParser: window.DOMParser,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    FocusEvent: window.FocusEvent,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLAnchorElement: window.HTMLAnchorElement,
    HTMLImageElement: window.HTMLImageElement,
    getComputedStyle: window.getComputedStyle.bind(window),
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  }

  for (const [key, value] of Object.entries(bindings)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    })
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value:
      window.ResizeObserver ??
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    writable: true,
  })

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value:
      window.IntersectionObserver ??
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    writable: true,
  })

  Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
    configurable: true,
    value: window.__TAURI_INTERNALS__,
    writable: true,
  })

  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: window.scrollTo?.bind(window) ?? (() => {}),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value:
      window.matchMedia ??
      ((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false
        },
      })),
  })
}

function restoreDomGlobals(window) {
  window.close()

  for (const key of [
    '__TAURI_INTERNALS__',
    'IntersectionObserver',
    'ResizeObserver',
    'HTMLImageElement',
    'HTMLAnchorElement',
    'HTMLTextAreaElement',
    'HTMLSelectElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'FocusEvent',
    'MouseEvent',
    'KeyboardEvent',
    'Event',
    'CustomEvent',
    'DOMParser',
    'SVGElement',
    'Node',
    'Element',
    'HTMLElement',
    'navigator',
    'self',
    'document',
    'window',
    'localStorage',
    'sessionStorage',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ]) {
    delete globalThis[key]
  }
}

function createDesktopConfig(mode, baseUrl, port) {
  return {
    mode,
    baseUrl,
    port,
    timeoutMs: 10000,
  }
}

function createHealth(overrides = {}) {
  return {
    status: 'ok',
    service: 'stealth-lightbeacon-api',
    apiVersion: APP_VERSION,
    authRequired: false,
    compatibility: {
      minimumDesktopVersion: DESKTOP_VERSION,
      recommendedDesktopVersion: DESKTOP_VERSION,
    },
    ...overrides,
  }
}

function createCapabilities(overrides = {}) {
  return {
    apiMode: {
      mode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      transport: 'https',
      apiVersion: APP_VERSION,
      supportsRemote: true,
    },
    evaluationProfiles: ['baseline', 'deep', 'export'],
    outputFormats: ['json', 'markdown', 'html'],
    supportsRecon: true,
    supportsArtifacts: true,
    ...overrides,
  }
}

function createReconResult() {
  return {
    target: 'https://example.com',
    recommendation: 'Proceed with audit',
    posture: 'low-risk',
    confidence: 0.87,
    evidence: ['Clean headers', 'Low link density'],
    evidenceSummary: 'Two signals support a low-risk posture.',
    signals: ['headers', 'links'],
    autoSelectAllowed: true,
  }
}

function createSnapshot() {
  return {
    evaluation: {
      evaluationId: 'eval-cached',
      status: 'success',
      acceptedAt: '2026-05-25T08:00:00Z',
    },
    evaluationStatus: {
      evaluationId: 'eval-cached',
      status: 'success',
      stage: 'completed',
      progressPercent: 100,
      message: 'Cached terminal result.',
      exitState: 'success',
      terminal: true,
    },
    evaluationResult: {
      evaluationId: 'eval-cached',
      status: 'success',
      summary: {
        score: 92,
        passed: 8,
        warnings: 1,
        failed: 0,
      },
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 1,
        low: 2,
        info: 3,
      },
      findings: [],
      startedAt: '2026-01-15T10:00:00Z',
      completedAt: '2026-01-15T10:00:03Z',
    },
    artifacts: [
      {
        name: 'html-report',
        kind: 'html',
        mediaType: 'text/html',
        downloadUrl: 'https://downloads.example.test/eval-cached/report.html',
      },
    ],
  }
}

function createInvokeStub(scenario) {
  return async (command, args) => {
    switch (command) {
      case 'get_backend_config':
        return scenario.backendConfig
      case 'set_backend_config':
        return args?.config ?? scenario.backendConfig
      case 'api_health_check':
        if (scenario.healthError) {
          throw scenario.healthError
        }
        return scenario.health
      case 'get_capabilities':
        if (scenario.capabilitiesError) {
          throw scenario.capabilitiesError
        }
        return scenario.capabilities
      case 'create_evaluation':
        return {
          evaluationId: 'eval-123',
          status: 'accepted',
          acceptedAt: '2026-05-26T12:00:00Z',
        }
      case 'get_evaluation_status':
        return {
          evaluationId: 'eval-123',
          status: 'success',
          stage: 'completed',
          progressPercent: 100,
          message: 'Evaluation complete.',
          exitState: 'success',
          terminal: true,
        }
      case 'get_evaluation_result':
        return {
          evaluationId: 'eval-123',
          status: 'success',
          summary: { score: 92, passed: 8, warnings: 1, failed: 0 },
          severityCounts: { critical: 0, high: 0, medium: 1, low: 2, info: 3 },
          findings: [
            {
              ruleId: 'tls-version',
              title: 'TLS version review',
              severity: 'medium',
              status: 'warn',
              description: 'Server still negotiates a legacy TLS fallback.',
            },
          ],
          startedAt: '2026-01-15T10:00:00Z',
          completedAt: '2026-01-15T10:00:03Z',
        }
      case 'get_evaluation_artifacts':
        return []
      case 'run_recon':
        return scenario.reconResult ?? createReconResult()
      case 'get_last_opened_snapshot':
        return scenario.snapshot ?? createSnapshot()
      case 'set_last_opened_snapshot':
        return args?.snapshot ?? null
      default:
        return undefined
    }
  }
}

function createDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'http://127.0.0.1/',
  })

  Object.defineProperty(dom.window, 'innerWidth', {
    configurable: true,
    value: 1440,
    writable: true,
  })
  Object.defineProperty(dom.window, 'innerHeight', {
    configurable: true,
    value: 960,
    writable: true,
  })

  return dom
}

async function waitFor(predicate, label, timeoutMs = 6000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const value = predicate()
    if (value) {
      return value
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(`Timed out waiting for ${label}`)
}

function getButtons(window) {
  return [...window.document.querySelectorAll('button')]
}

function clickButton(window, matcher, label) {
  const button = getButtons(window).find((candidate) =>
    matcher(normalizeText(candidate.textContent ?? '')),
  )

  if (!button) {
    throw new Error(`Missing ${label}`)
  }

  button.click()
}

function getTabButton(window, tabLabel) {
  const button = getButtons(window).find((candidate) =>
    normalizeText(candidate.textContent ?? '').startsWith(tabLabel),
  )

  if (!button) {
    throw new Error(`Missing ${tabLabel} tab`)
  }

  return button
}

async function clickTab(window, tabLabel) {
  const button = getTabButton(window, tabLabel)
  button.click()
  await waitFor(() => button.getAttribute('aria-selected') === 'true', `${tabLabel} tab`)
}

async function loadBuiltApp(bundlePath, scenario) {
  const dom = createDom()
  const { window } = dom

  window.__TAURI_INTERNALS__ = {
    invoke: createInvokeStub(scenario),
  }

  installDomGlobals(window)

  try {
    const bundleUrl = new URL(pathToFileURL(bundlePath).href)
    bundleUrl.searchParams.set('scenario', scenario.name)
    await import(bundleUrl.href)
    await waitFor(
      () => normalizeText(window.document.body.textContent ?? '').includes('Stealth Lightbeacon'),
      'app bootstrap',
    )
    return dom
  } catch (error) {
    restoreDomGlobals(window)
    throw error
  }
}

async function expectText(window, expected, label) {
  await waitFor(
    () => normalizeText(window.document.body.textContent ?? '').includes(expected),
    label,
  )
}

async function runSmokeScenario(scenario) {
  const bundlePath = readBuiltBundlePath()
  const dom = await loadBuiltApp(bundlePath, scenario)
  const { window } = dom

  try {
    await expectText(window, 'Stealth Lightbeacon', 'shell headline')

    if (scenario.kind === 'recon') {
      await clickTab(window, 'Audit')
      const reconButton = await waitFor(() => {
        const button = getButtons(window).find(
          (candidate) => normalizeText(candidate.textContent ?? '') === 'Run recon',
        )
        return button && !button.disabled ? button : null
      }, 'recon availability')
      reconButton.click()
      await expectText(window, scenario.expect.recommendation, 'recon recommendation')
      await expectText(window, scenario.expect.posture, 'recon posture')
      await expectText(window, scenario.expect.confidence, 'recon confidence')
      console.log(`validate-shell smoke: ${scenario.name} ok`)
      return
    }

    await clickTab(window, 'Connection')
    await expectText(window, 'Capabilities unavailable.', 'policy notice')
    await expectText(window, scenario.expect.noticeFragment, 'policy message')
    await expectText(window, scenario.expect.status, 'policy status')
    await expectText(window, scenario.expect.guidance, 'policy guidance')
    console.log(`validate-shell smoke: ${scenario.name} ok`)
  } finally {
    restoreDomGlobals(window)
  }
}

async function runA11yScan(scenario) {
  const bundlePath = readBuiltBundlePath()
  const dom = await loadBuiltApp(bundlePath, scenario)
  const { window } = dom
  const axeModule = await import('axe-core')
  const axe = axeModule.default ?? axeModule

  try {
    for (const tabName of ['Overview', 'Connection', 'Audit', 'Results', 'Activity', 'Settings']) {
      await clickTab(window, tabName)

      const { violations } = await axe.run(window.document.body, {
        rules: {
          region: { enabled: false },
          'color-contrast': { enabled: false },
        },
      })

      if (violations.length > 0) {
        const summary = violations
          .map((violation) => {
            const nodes = violation.nodes
              .map((node) => node.target.join(' > '))
              .join(', ')
            return `${violation.id}: ${nodes}`
          })
          .join('\n')

        throw new Error(`Axe violations on ${tabName} tab:\n${summary}`)
      }
    }

    console.log(`validate-shell axe: ${scenario.name} ok`)
  } finally {
    restoreDomGlobals(window)
  }
}

async function main() {
  run('npm', ['run', 'build'], ROOT)

  const smokeScenarios = [
    {
      name: 'recon flow',
      kind: 'recon',
      backendConfig: createDesktopConfig('standalone', 'http://127.0.0.1:9311', 9311),
      health: createHealth({
        service: 'stealth-lightbeacon-standalone',
        apiVersion: APP_VERSION,
      }),
      capabilities: createCapabilities({
        apiMode: {
          mode: 'standalone',
          baseUrl: 'http://127.0.0.1:9311',
          transport: 'embedded',
          apiVersion: APP_VERSION,
          supportsRemote: true,
        },
      }),
      reconResult: createReconResult(),
      expect: {
        recommendation: 'Proceed with audit',
        posture: 'low-risk',
        confidence: 'Confidence 87%',
      },
    },
    {
      name: 'remote auth guidance',
      kind: 'policy',
      backendConfig: createDesktopConfig('remote', 'https://api.example.test:9443', 9443),
      health: createHealth({
        authRequired: true,
      }),
      capabilities: null,
      capabilitiesError: {
        code: 'unauthorized',
        message: 'Remote API auth required.',
        status: 401,
        details: 'STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN',
      },
      expect: {
        noticeFragment: 'Remote API auth required.',
        status: 'Remote API / 0.1.0 / capabilities unavailable',
        guidance: 'Set STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN before reconnecting.',
      },
    },
    {
      name: 'compatibility guidance',
      kind: 'policy',
      backendConfig: createDesktopConfig('remote', 'https://api.example.test:9443', 9443),
      health: createHealth({
        compatibility: {
          minimumDesktopVersion: '0.2.0',
          recommendedDesktopVersion: '0.2.1',
        },
      }),
      capabilities: null,
      capabilitiesError: {
        code: 'incompatible_client',
        message: 'Desktop version is not supported by this backend.',
        status: 409,
        details: '0.2.0',
      },
      expect: {
        noticeFragment: 'Desktop version is not supported by this backend.',
        status: 'Remote API / 0.1.0 / capabilities unavailable',
        guidance: 'Upgrade the desktop client to 0.2.0 or newer.',
      },
    },
  ]

  if (runSmoke) {
    await runSmokeScenario(smokeScenarios[0])
    await runSmokeScenario(smokeScenarios[1])
    await runSmokeScenario(smokeScenarios[2])
  }

  if (runA11y) {
    await runA11yScan({
      name: 'a11y baseline',
      kind: 'policy',
      backendConfig: createDesktopConfig('remote', 'https://api.example.test:9443', 9443),
      health: createHealth({
        authRequired: false,
        compatibility: {
          minimumDesktopVersion: DESKTOP_VERSION,
          recommendedDesktopVersion: DESKTOP_VERSION,
        },
      }),
      capabilities: createCapabilities({
        apiMode: {
          mode: 'remote',
          baseUrl: 'https://api.example.test:9443',
          transport: 'https',
          apiVersion: APP_VERSION,
          supportsRemote: true,
        },
      }),
      snapshot: createSnapshot(),
    })
  }
}

await main()
