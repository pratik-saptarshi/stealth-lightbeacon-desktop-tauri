import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('implementation queue phase map', () => {
  it('spells out the R2 to R4 execution ladder in the roadmap queue', () => {
    const queue = readFileSync(
      resolve(process.cwd(), 'docs/roadmap/implementation-queue.md'),
      'utf8',
    )

    expect(queue).toContain('stealth-lightbeacon-desktop-tauri-n3z.3')
    expect(queue).toContain('Phase R2')
    expect(queue).toContain('Phase R3')
    expect(queue).toContain('Phase R4')
    expect(queue).toContain('GitHub publication')
    expect(queue).toContain('R2 is testable before R3')
    expect(queue).toContain('R3 must pass before R4 begins')
  })
})
