import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('package manager policy', () => {
  it('uses pnpm in scripts and contributor docs', () => {
    const repoRoot = process.cwd()
    const packageJson = readFileSync(resolve(repoRoot, 'package.json'), 'utf8')
    const contributing = readFileSync(resolve(repoRoot, 'contributing.md'), 'utf8')
    const cliReadme = readFileSync(resolve(repoRoot, 'readme-CLI.md'), 'utf8')

    expect(packageJson).toContain('"packageManager": "pnpm@')
    expect(packageJson).not.toMatch(/\bnpm run\b/)

    expect(contributing).toContain('pnpm run check')
    expect(contributing).not.toMatch(/\bnpm run\b/)

    expect(cliReadme).toContain('pnpm run dev')
    expect(cliReadme).not.toMatch(/\bnpm run\b/)
  })
})
