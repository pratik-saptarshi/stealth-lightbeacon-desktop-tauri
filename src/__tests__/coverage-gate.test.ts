import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import vitestConfig from '../../vitest.config'

describe('coverage gate uplift', () => {
  it('pins the shell coverage thresholds at 85 percent or higher', () => {
    const coverage = vitestConfig.test?.coverage

    expect(coverage?.thresholds?.lines).toBeGreaterThanOrEqual(85)
    expect(coverage?.thresholds?.statements).toBeGreaterThanOrEqual(85)
    expect(coverage?.thresholds?.branches).toBeGreaterThanOrEqual(85)
    expect(coverage?.thresholds?.functions).toBeGreaterThanOrEqual(85)
  })

  it('records the current coverage baseline instead of a below-target gap', () => {
    const coverageRoadmap = readFileSync(
      resolve(process.cwd(), 'docs/roadmap/testing-coverage-uplift.md'),
      'utf8',
    )

    expect(coverageRoadmap).toContain('Statements: `91.73%`')
    expect(coverageRoadmap).toContain('Lines: `91.61%`')
    expect(coverageRoadmap).toContain('Functions: `95.65%`')
    expect(coverageRoadmap).toContain('Branches: `87.84%`')
    expect(coverageRoadmap).toContain('Statement coverage now clears the 90% target.')
    expect(coverageRoadmap).toContain('Branch coverage now clears the repo gate')
    expect(coverageRoadmap).not.toContain('Branch coverage remains below 90%')
  })
})
