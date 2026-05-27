import { expect, test } from '@playwright/test'

import { expectNoA11yViolations } from './axe'

const appUrl = 'http://127.0.0.1:4180'

test.describe('Accessibility scan', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto(appUrl)

    await expect(
      page.getByRole('heading', { name: 'Stealth Lightbeacon' }),
    ).toBeVisible()
  })

  test('keeps the shell, settings, and recon surfaces axe-clean', async ({ page }) => {
    await expectNoA11yViolations(page)

    await page.getByRole('tab', { name: /^Settings/i }).click()
    await expect(page.getByRole('tabpanel', { name: /^Settings/i })).toBeVisible()
    await expectNoA11yViolations(page)

    await page.getByRole('tab', { name: /^Audit/i }).click()
    await expect(page.getByRole('tabpanel', { name: /^Audit/i })).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
