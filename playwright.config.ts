import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
dotenv.config()

const PORT = Number(process.env.TEST_PORT ?? 4323)
const BASE = `http://127.0.0.1:${PORT}`

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
    command: `PORT=${PORT} node dist/server/entry.mjs`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
