import { defineConfig, devices } from '@playwright/test';

// Use a dedicated port so `npm start` (4180) or another local preview can never
// be mistaken for the app under test.
const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '4280', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 15_000,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(PORT),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
});
