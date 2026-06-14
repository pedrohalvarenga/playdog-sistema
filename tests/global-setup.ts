import { chromium, type FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Faz login uma vez e salva o estado de sessão para todos os testes.
// Credenciais vêm das variáveis de ambiente (GitHub Secrets):
//   SMOKE_USER — nome ou e-mail de login
//   SMOKE_PASS — senha
async function globalSetup(config: FullConfig) {
  // Permite pular o login quando já existe um state.json válido (debug local)
  if (process.env.SMOKE_SKIP_LOGIN === '1') return

  // || (não ??) porque secret ausente no CI vem como string vazia, não undefined
  const baseURL = process.env.SMOKE_BASE_URL || 'https://playdog-sistema.vercel.app'
  const user = process.env.SMOKE_USER
  const pass = process.env.SMOKE_PASS

  if (!user || !pass) {
    throw new Error('SMOKE_USER e SMOKE_PASS precisam estar definidos (GitHub Secrets).')
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' })
  await page.fill('#usuario', user)
  await page.fill('#senha', pass)
  await page.click('button[type="submit"]')

  // Espera o redirecionamento para o dashboard (login bem-sucedido)
  await page.waitForURL('**/dashboard', { timeout: 30_000 })

  const authDir = path.join(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })
  await page.context().storageState({ path: path.join(authDir, 'state.json') })

  await browser.close()
}

export default globalSetup
