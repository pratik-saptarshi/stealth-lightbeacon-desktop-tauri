import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Playwright webServer command', () => {
  it('does not depend on pnpm exec for Vite startup', () => {
    expect(playwrightConfig.webServer?.command).toBeDefined();
    expect(playwrightConfig.webServer?.command).not.toContain('pnpm exec');
  });
});
