import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('glib advisory tracker', () => {
  it('records the current upstream monitoring state and exit condition', () => {
    const tracker = readFileSync(
      resolve(process.cwd(), 'docs/roadmap/glib-advisory-tracker.md'),
      'utf8',
    )

    expect(tracker).toContain('glib 0.18.5')
    expect(tracker).toContain('wry v0.55.1')
    expect(tracker).toContain('monitor upstream Tauri, Wry, and GTK releases')
    expect(tracker).toContain('glib >= 0.20.0')
    expect(tracker).toContain('keep the advisory issue open')
  })
})
