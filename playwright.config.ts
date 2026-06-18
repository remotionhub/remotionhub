import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || 4173)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
const chromeChannel = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? 'chrome' : undefined

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.pw\.test\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
        url: `${baseURL}/favicon.ico`,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: chromeChannel } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: chromeChannel } },
  ],
})
