import { expect, test } from '@playwright/test'

const appUrl = 'http://127.0.0.1:4180'

test.describe('Stealth Lightbeacon shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto(appUrl)

    await expect(
      page.getByRole('heading', { name: 'Stealth Lightbeacon' }),
    ).toBeVisible()
  })

  test('keeps inactive panels hidden behind horizontal tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^Home/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(
      page.getByRole('tabpanel', { name: /^Scan/i }),
    ).toBeHidden()

    await page.getByRole('tab', { name: /^Settings/i }).click()

    await expect(page.getByRole('tabpanel', { name: /^Settings/i })).toBeVisible()
    await expect(
      page.getByRole('tabpanel', { name: /^Home/i }),
    ).toBeHidden()
    await expect(page.getByRole('tab', { name: /^Settings/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('offers standard laptop and desktop presets in settings', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: /^Settings/i }).click()
    const settingsPanel = page.getByRole('tabpanel', { name: /^Settings/i })

    await expect(page.getByRole('radio', { name: /Auto detect/i })).toBeChecked()
    await expect(
      page.getByRole('radio', { name: /13-inch laptop/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: /15-inch laptop/i }),
    ).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Desktop$/i })).toBeVisible()
    await expect(
      page.getByRole('radio', { name: /^Wide desktop$/i }),
    ).toBeVisible()

    await page.getByRole('radio', { name: /^Desktop$/i }).check()

    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-workspace-size',
      'desktop',
    )
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--compact/)
    await expect(
      settingsPanel.getByText(/Desktop layout defaults keep the shell compact/i),
    ).toBeVisible()

    await page.getByRole('tab', { name: /^Home/i }).click()
    const adaptedMetrics = await page.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }))
    expect(
      Math.max(adaptedMetrics.bodyScrollHeight, adaptedMetrics.docScrollHeight),
    ).toBeLessThanOrEqual(adaptedMetrics.innerHeight)
  })

  test('shows the recon advisory surface in the audit tab', async ({ page }) => {
    await page.getByRole('tab', { name: /^Scan/i }).click()

    await expect(page.getByText(/Web Companion Optimization Hub/i)).toBeVisible()
    await expect(page.getByText(/One target. Four checks. One report./i)).toBeVisible()
    await expect(page.getByText(/^Recon advisory$/i)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Target posture and transport hints/i }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Run Recon/i })).toBeDisabled()
    await expect(
      page.getByText(/Reconnect capabilities and choose a target before running recon\./i),
    ).toBeVisible()
  })

  test('shows reports tab trace and report-download table', async ({ page }) => {
    await page.getByRole('tab', { name: /^Reports/i }).click()
    await expect(
      page.getByRole('heading', { name: /Reporting Operations/i }),
    ).toBeVisible()
    await expect(page.getByRole('table', { name: 'Report downloads' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Report' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Filename' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible()
    await expect(page.getByText('No report downloads available yet.')).toBeVisible()
  })

  test('stays within the 800 x 600 baseline without vertical scrolling', async ({
    page,
  }) => {
    const metrics = await page.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }))

    expect(Math.max(metrics.bodyScrollHeight, metrics.docScrollHeight)).toBeLessThanOrEqual(
      metrics.innerHeight,
    )
  })
})
