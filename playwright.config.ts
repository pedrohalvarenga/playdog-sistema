import { defineConfig, devices } from '@playwright/test'

// Verificação diária de fumaça (smoke) — somente leitura, roda contra produção.
// Não cria nem altera dados. Veja tests/smoke.spec.ts.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'smoke-results.json' }],
  ],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://playdog-sistema.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  globalSetup: './tests/global-setup.ts',
  projects: [
    {
      name: 'smoke',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/state.json',
      },
    },
  ],
})
