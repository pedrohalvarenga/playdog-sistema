import { test, expect, type Page } from '@playwright/test'

// ============================================================
// Verificação diária de fumaça (smoke) — SOMENTE LEITURA.
// Abre cada tela do sistema autenticado e confere que ela
// carrega sem erro de runtime, sem erro de servidor (5xx) e
// sem a tela de erro do Next. Não cria nem altera dados.
// ============================================================

// Rotas estáticas/de navegação (sem :id). Cobre toda a árvore principal.
const ROTAS = [
  '/dashboard',
  '/pets', '/pets/novo',
  '/tutores', '/tutores/novo',
  '/creche', '/creche/checkin', '/creche/resumo', '/creche/cobranca',
  '/hotel', '/hotel/reservas', '/hotel/reservas/nova', '/hotel/agenda',
  '/hotel/plantao', '/hotel/plantao/pagamentos', '/hotel/plantao/plantonistas',
  '/hotel/plantao/plantonistas/novo', '/hotel/relatorio', '/hotel/config',
  '/banho-tosa', '/banho-tosa/agendamentos', '/banho-tosa/agendamentos/novo',
  '/adaptacao',
  '/transportes', '/transportes/relatorio', '/transportes/abastecimento', '/transportes/veiculo',
  '/financeiro', '/financeiro/receitas', '/financeiro/receitas/nova',
  '/financeiro/despesas', '/financeiro/despesas/nova', '/financeiro/caixa',
  '/financeiro/dre', '/financeiro/orcamento', '/financeiro/projecao',
  '/financeiro/pendencias', '/financeiro/recorrentes', '/financeiro/dashboard',
  '/financeiro/conciliacao', '/financeiro/parcelamentos/novo',
  '/financeiro/relatorios/faturamento',
  '/admin',
]

// Textos que indicam que a página quebrou
const SINAIS_DE_ERRO = [
  'Application error',
  'Internal Server Error',
  'This page could not be found',
  'Unhandled Runtime Error',
  'client-side exception',
]

async function abrirEConferir(page: Page, rota: string) {
  const erros: string[] = []

  // Captura exceções de runtime e respostas 5xx durante o carregamento
  const onPageError = (e: Error) => erros.push(`runtime: ${e.message}`)
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() >= 500) erros.push(`HTTP ${r.status()} em ${r.url()}`)
  }
  page.on('pageerror', onPageError)
  page.on('response', onResponse)

  const resp = await page.goto(rota, { waitUntil: 'networkidle' })

  // Não pode ter sido redirecionado para /login (sessão perdida)
  expect(page.url(), `${rota} redirecionou para login (sessão expirou?)`).not.toContain('/login')

  // Status da navegação principal não pode ser erro
  if (resp) {
    expect(resp.status(), `${rota} retornou HTTP ${resp.status()}`).toBeLessThan(500)
  }

  // A página não pode exibir nenhum sinal de erro
  const corpo = await page.locator('body').innerText()
  for (const sinal of SINAIS_DE_ERRO) {
    expect(corpo, `${rota} mostrou "${sinal}"`).not.toContain(sinal)
  }

  // Tem que haver conteúdo renderizado
  expect(corpo.trim().length, `${rota} carregou vazia`).toBeGreaterThan(0)

  page.off('pageerror', onPageError)
  page.off('response', onResponse)

  expect(erros, `${rota} teve erros:\n${erros.join('\n')}`).toHaveLength(0)
}

for (const rota of ROTAS) {
  test(`carrega ${rota}`, async ({ page }) => {
    await abrirEConferir(page, rota)
  })
}

// Bônus: abre a 1ª reserva e o 1º pet (telas de detalhe com :id),
// só navegando — sem alterar nada.
test('abre detalhe da primeira reserva de hotel', async ({ page }) => {
  await page.goto('/hotel/reservas', { waitUntil: 'networkidle' })
  const primeiro = page.locator('a[href^="/hotel/reservas/"]').first()
  if (await primeiro.count() === 0) test.skip(true, 'sem reservas para abrir')
  await primeiro.click()
  await page.waitForLoadState('networkidle')
  const corpo = await page.locator('body').innerText()
  for (const sinal of SINAIS_DE_ERRO) expect(corpo).not.toContain(sinal)
})

test('abre detalhe do primeiro pet', async ({ page }) => {
  await page.goto('/pets', { waitUntil: 'networkidle' })
  const primeiro = page.locator('a[href^="/pets/"]').first()
  if (await primeiro.count() === 0) test.skip(true, 'sem pets para abrir')
  await primeiro.click()
  await page.waitForLoadState('networkidle')
  const corpo = await page.locator('body').innerText()
  for (const sinal of SINAIS_DE_ERRO) expect(corpo).not.toContain(sinal)
})
