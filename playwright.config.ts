import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
dotenv.config()

const PORT = Number(process.env.TEST_PORT ?? 4323)
const BASE = `https://localhost:${PORT}`
const PROFILE = process.env.TEST_PROFILE_DIR ?? '.tmp/e2e-profile'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], args: ['--no-sandbox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], args: ['--no-sandbox'] },
    },
  ],
  webServer: {
    command: `PORT=${PORT} HOST=0.0.0.0 TEST_PROFILE_DIR=${PROFILE} node scripts/e2e-server.mjs`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
})
