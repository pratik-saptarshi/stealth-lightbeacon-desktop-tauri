import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Playwright webServer command', () => {
  it('does not depend on pnpm exec for Vite startup', () => {
    const webServer = Array.isArray(playwrightConfig.webServer)
      ? playwrightConfig.webServer[0]
      : playwrightConfig.webServer

    expect(webServer?.command).toBeDefined();
    expect(webServer?.command).not.toContain('pnpm exec');
  });
});
