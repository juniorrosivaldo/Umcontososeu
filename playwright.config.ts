import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--no-sandbox'],
    },
  },
  webServer: [
    {
      command: '.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8011',
      url: 'http://127.0.0.1:8011/health',
      reuseExistingServer: false,
      env: {
        APP_MODE: 'local',
        DATABASE_URL: `sqlite:////tmp/umconto-e2e-${process.pid}.db`,
        AI_ENABLED: 'false',
      },
    },
    {
      command: 'npm run start -- --port 3001',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: false,
      env: {
        BACKEND_URL: 'http://127.0.0.1:8011',
        APP_MODE: 'local',
        NEXT_PUBLIC_AUTH_MODE: 'local',
      },
    },
  ],
});
