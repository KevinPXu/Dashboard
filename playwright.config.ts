import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const baseConfig = {
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: (process.env.CI ? 'github' : 'list') as 'github' | 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry' as const,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
};

export default defineConfig(
  process.env.PLAYWRIGHT_BASE_URL
    ? baseConfig
    : {
        ...baseConfig,
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      },
);
