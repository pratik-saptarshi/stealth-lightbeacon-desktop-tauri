#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const APP_VERSION = '0.1.0'
const DESKTOP_VERSION = '0.1.1'

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

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        if (!address || typeof address === 'string') {
          reject(new Error('Unable to allocate a free port'))
          return
        }

        resolve(address.port)
      })
    })
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, label, timeoutMs = 15000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const value = await predicate()
    if (value) {
      return value
    }

    await delay(50)
  }

  throw new Error(`Timed out waiting for ${label}`)
}

async function waitForHttp(url, label, timeoutMs = 15000) {
  await waitFor(async () => {
    try {
      const response = await fetch(url)
      return response.ok
    } catch {
      return false
    }
  }, label, timeoutMs)
}

async function waitForJson(url, label, timeoutMs = 15000) {
  return await waitFor(async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch {
      return null
    }
  }, label, timeoutMs)
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM,
    process.env.CHROMIUM_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chromium',
    'chromium-browser',
    'google-chrome',
    'google-chrome-stable',
  ].filter(Boolean)

  for (const candidate of candidates) {
    const resolved = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
    })

    if (resolved.status === 0) {
      return candidate
    }
  }

  fail('browser smoke: unable to locate Chromium or Chrome on PATH')
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.socket = null
    this.nextId = 1
    this.pending = new Map()
  }

  async connect() {
    const socket = new WebSocket(this.wsUrl)
    this.socket = socket

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      if (typeof message.id === 'number') {
        const pending = this.pending.get(message.id)
        if (!pending) {
          return
        }

        this.pending.delete(message.id)

        if (message.error) {
          pending.reject(
            new Error(
              message.error.message ??
                message.error.data ??
                'CDP command failed',
            ),
          )
          return
        }

        pending.resolve(message.result ?? {})
      }
    })

    socket.addEventListener('error', (event) => {
      for (const pending of this.pending.values()) {
        pending.reject(event.error ?? new Error('CDP socket error'))
      }
      this.pending.clear()
    })

    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener(
        'error',
        () => {
          reject(new Error('Unable to connect to Chromium debugger'))
        },
        { once: true },
      )
    })
  }

  send(method, params = {}, sessionId) {
    if (!this.socket) {
      throw new Error('CDP client is not connected')
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })

      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      )
    })
  }

  close() {
    this.socket?.close()

    for (const pending of this.pending.values()) {
      pending.reject(new Error('CDP client closed'))
    }
    this.pending.clear()
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

function createScenarioInvokeStub(scenario) {
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
        return null
      case 'set_last_opened_snapshot':
        return args?.snapshot ?? null
      default:
        return undefined
    }
  }
}

function createBrowserScenario(name, kind, overrides = {}) {
  return {
    name,
    kind,
    backendConfig: createDesktopConfig(
      overrides.backendMode ?? 'standalone',
      overrides.baseUrl ?? 'http://127.0.0.1:9311',
      overrides.port ?? 9311,
    ),
    health: createHealth(overrides.health ?? {}),
    capabilities: overrides.capabilities ?? createCapabilities(overrides.capabilityOverrides ?? {}),
    reconResult: overrides.reconResult ?? createReconResult(),
    healthError: overrides.healthError ?? null,
    capabilitiesError: overrides.capabilitiesError ?? null,
    expect: overrides.expect ?? {},
  }
}

function buildScenarioInitScript(scenario) {
  const invokeStub = createScenarioInvokeStub(scenario)
  const invokeSource = invokeStub.toString()

  return `
    (() => {
      const scenario = ${JSON.stringify(scenario)};
      const invoke = ${invokeSource};
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: { invoke: (command, args) => invoke(command, args) },
      });
      window.__SMOKE_SCENARIO__ = scenario;
    })();
  `
}

async function evalPage(client, sessionId, expression) {
  const result = await client.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  )

  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description
    fail(description ?? 'Runtime evaluation failed')
  }

  return result.result?.value
}

async function getBodyText(client, sessionId) {
  return normalizeText(
    String(
      (await evalPage(
        client,
        sessionId,
        'document.body ? document.body.innerText : ""',
      )) ?? '',
    ),
  )
}

async function clickSelector(client, sessionId, selector) {
  await evalPage(
    client,
    sessionId,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error('Missing selector: ${selector.replace(/'/g, "\\'")}');
      }
      element.click();
      return true;
    })()`,
  )
}

async function waitForText(client, sessionId, expected, label, timeoutMs = 10000) {
  await waitFor(async () => {
    const text = await getBodyText(client, sessionId)
    return text.includes(expected)
  }, label, timeoutMs)
}

async function waitForPanelText(
  client,
  sessionId,
  selector,
  expected,
  label,
  timeoutMs = 10000,
) {
  let lastText = ''

  await waitFor(async () => {
    const text = await evalPage(
      client,
      sessionId,
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element ? element.textContent ?? '' : '';
      })()`,
    )

    lastText = normalizeText(String(text ?? ''))
    return lastText.includes(expected)
  }, label, timeoutMs).catch((error) => {
    throw new Error(`${error.message}: ${lastText}`)
  })
}

async function waitForTabState(client, sessionId, tabId, selected) {
  await waitFor(async () => {
    const state = await evalPage(
      client,
      sessionId,
      `(() => {
        const tab = document.getElementById(${JSON.stringify(tabId)});
        if (!tab) {
          return null;
        }
        return tab.getAttribute('aria-selected');
      })()`,
    )

    return state === (selected ? 'true' : 'false')
  }, `${tabId} selection`, 10000)
}

async function assertWorkspaceTabs(client, sessionId) {
  const tabOrder = [
    ['workspace-tab-audit', 'workspace-panel-audit'],
    ['workspace-tab-results', 'workspace-panel-results'],
    ['workspace-tab-activity', 'workspace-panel-activity'],
    ['workspace-tab-settings', 'workspace-panel-settings'],
  ]

  for (const [tabId, panelId] of tabOrder) {
    await clickSelector(client, sessionId, `#${tabId}`)
    await waitForTabState(client, sessionId, tabId, true)

    const state = await evalPage(
      client,
      sessionId,
      `(() => {
        const tab = document.getElementById(${JSON.stringify(tabId)});
        const panel = document.getElementById(${JSON.stringify(panelId)});
        return {
          tabSelected: tab ? tab.getAttribute('aria-selected') : null,
          panelHidden: panel ? panel.hidden : null,
        };
      })()`,
    )

    if (!state || state.tabSelected !== 'true' || state.panelHidden !== false) {
      fail(`browser smoke: ${tabId} did not activate ${panelId}`)
    }
  }
}

async function launchPreviewServer(previewPort) {
  const preview = spawn(
    'npm',
    [
      'run',
      'preview',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(previewPort),
      '--strictPort',
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let previewOutput = ''
  let closed = false
  preview.stdout.on('data', (chunk) => {
    previewOutput += chunk.toString()
  })
  preview.stderr.on('data', (chunk) => {
    previewOutput += chunk.toString()
  })

  preview.once('exit', (code) => {
    if (!closed && code !== 0) {
      fail(`browser smoke: preview server exited early (${code ?? 'unknown'})\n${previewOutput}`)
    }
  })

  const previewUrl = `http://127.0.0.1:${previewPort}/`
  await waitForHttp(previewUrl, 'preview server')

  return {
    preview,
    previewUrl,
    async close() {
      closed = true
      await new Promise((resolve) => {
        preview.once('exit', resolve)
        preview.kill('SIGTERM')
      })
    },
  }
}

async function launchChromium(chromiumPath, debugPort, previewUrl, scenario) {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'stealth-lightbeacon-browser-'))
  const browser = spawn(
    chromiumPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--remote-debugging-port=' + String(debugPort),
      '--user-data-dir=' + userDataDir,
      'about:blank',
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let browserOutput = ''
  let closed = false
  browser.stdout.on('data', (chunk) => {
    browserOutput += chunk.toString()
  })
  browser.stderr.on('data', (chunk) => {
    browserOutput += chunk.toString()
  })

  browser.once('exit', (code) => {
    if (!closed && code !== 0) {
      fail(`browser smoke: Chromium exited early (${code ?? 'unknown'})\n${browserOutput}`)
    }
  })

  const version = await waitForJson(
    `http://127.0.0.1:${debugPort}/json/version`,
    'Chromium debugger',
  )

  const client = new CdpClient(version.webSocketDebuggerUrl)
  await client.connect()

  const initScript = buildScenarioInitScript(scenario)
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await client.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })

  await client.send(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: initScript,
    },
    sessionId,
  )
  await client.send('Page.enable', {}, sessionId)
  await client.send('Runtime.enable', {}, sessionId)
  await client.send('Page.navigate', { url: previewUrl }, sessionId)
  await waitForText(client, sessionId, 'Stealth Lightbeacon', 'shell bootstrap')

  return {
    browser,
    client,
    sessionId,
    userDataDir,
    async close() {
      closed = true
      await new Promise((resolve) => {
        browser.once('exit', resolve)
        browser.kill('SIGTERM')
      })
    },
  }
}

async function runScenario(scenario) {
  const previewPort = await getFreePort()
  const debugPort = await getFreePort()
  const chromiumPath = findChromium()
  const preview = await launchPreviewServer(previewPort)
  const runtime = await launchChromium(
    chromiumPath,
    debugPort,
    preview.previewUrl,
    scenario,
  )

  try {
    await waitForText(runtime.client, runtime.sessionId, 'Stealth Lightbeacon', 'headline')
    await assertWorkspaceTabs(runtime.client, runtime.sessionId)
    await clickSelector(runtime.client, runtime.sessionId, '#workspace-tab-audit')
    await waitForTabState(runtime.client, runtime.sessionId, 'workspace-tab-audit', true)

    if (scenario.kind === 'recon') {
      await clickSelector(
        runtime.client,
        runtime.sessionId,
        '#workspace-panel-audit button.secondary-action',
      )
      await waitForText(runtime.client, runtime.sessionId, 'Scan', 'recon tab stability')
      console.log(`browser smoke: ${scenario.name} ok`)
      return
    }

    await waitForText(runtime.client, runtime.sessionId, 'Submit Evaluation', 'audit submit')
    console.log(`browser smoke: ${scenario.name} ok`)
  } finally {
    runtime.client.close()
    await runtime.close()
    await preview.close()
    rmSync(runtime.userDataDir, { force: true, recursive: true })
  }
}

async function main() {
  run('npm', ['run', 'build'], ROOT)

  const smokeScenarios = [
    createBrowserScenario('recon flow', 'recon', {
      backendMode: 'standalone',
      baseUrl: 'http://127.0.0.1:9311',
      port: 9311,
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
      expect: {
        recommendation: 'Proceed with audit',
        posture: 'low-risk',
        confidence: 'Confidence 87%',
      },
    }),
    createBrowserScenario('remote auth guidance', 'policy', {
      backendMode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
      health: createHealth({
        authRequired: true,
      }),
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
        cardGuidance:
          'Set STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN, then save Connection and Check Health again.',
      },
    }),
    createBrowserScenario('compatibility guidance', 'policy', {
      backendMode: 'remote',
      baseUrl: 'https://api.example.test:9443',
      port: 9443,
      health: createHealth({
        compatibility: {
          minimumDesktopVersion: '0.2.0',
          recommendedDesktopVersion: '0.2.1',
        },
      }),
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
        cardGuidance: 'Desktop 0.1.1 is below the backend minimum 0.2.0.',
      },
    }),
  ]

  for (const scenario of smokeScenarios) {
    await runScenario(scenario)
  }
}

await main()
