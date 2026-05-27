import axe from 'axe-core'
import { expect, type Page } from '@playwright/test'

type AxeViolation = {
  id: string
  help: string
  impact: string | null
  nodes: Array<{
    target: string[]
  }>
}

type AxeRunResult = {
  violations: AxeViolation[]
}

function summarizeViolations(violations: AxeViolation[]) {
  if (violations.length === 0) {
    return 'axe-core reported no violations.'
  }

  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} @ ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    )
    .join('\n')
}

async function injectAxe(page: Page) {
  const hasAxe = await page.evaluate(() => {
    return Boolean((window as Window & { axe?: unknown }).axe)
  })

  if (!hasAxe) {
    await page.addScriptTag({ content: axe.source })
  }
}

export async function expectNoA11yViolations(page: Page, selector = '.app-shell') {
  await injectAxe(page)

  const results = await page.evaluate(async ({ selector }) => {
    const axeApi = (window as Window & {
      axe?: {
        run: (
          context: Element | Document,
          options: {
            runOnly: {
              type: 'tag';
              values: string[];
            }
          },
        ) => Promise<AxeRunResult>
      }
    }).axe

    if (!axeApi) {
      throw new Error('axe-core failed to load into the page')
    }

    const root = selector ? document.querySelector(selector) : document.body

    if (!root) {
      throw new Error(`Missing axe scan root: ${selector}`)
    }

    return axeApi.run(root, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    })
  }, { selector })

  expect(results.violations, summarizeViolations(results.violations)).toHaveLength(0)
}
