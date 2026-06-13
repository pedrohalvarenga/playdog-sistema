// Lê o resultado da verificação diária (smoke-results.json) e envia
// um e-mail de resumo via Resend. Usado pelo GitHub Actions.
//
// Variáveis de ambiente:
//   RESEND_API_KEY   — chave do Resend
//   RESEND_FROM      — remetente (ex.: "Play Dog <onboarding@resend.dev>")
//   SMOKE_EMAIL_TO   — destinatário (ex.: pedroalvarengamkt@gmail.com)
//   SMOKE_ALWAYS     — "true" para enviar mesmo quando tudo passa (padrão: só em falha)
//   GITHUB_RUN_URL   — link para os logs da execução (opcional)
import fs from 'fs'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM ?? 'Play Dog <onboarding@resend.dev>'
const TO = process.env.SMOKE_EMAIL_TO ?? 'pedroalvarengamkt@gmail.com'
const SEMPRE = process.env.SMOKE_ALWAYS === 'true'
const RUN_URL = process.env.GITHUB_RUN_URL ?? ''

function lerResultado() {
  try {
    return JSON.parse(fs.readFileSync('smoke-results.json', 'utf8'))
  } catch {
    return null
  }
}

// Extrai testes falhos do JSON do Playwright (estrutura aninhada de suites)
function coletarTestes(suite, acc = []) {
  for (const s of suite.suites ?? []) coletarTestes(s, acc)
  for (const spec of suite.specs ?? []) {
    const ok = spec.tests?.every(t => t.results?.every(r => r.status === 'passed' || r.status === 'skipped'))
    acc.push({ titulo: spec.title, ok: !!ok })
  }
  return acc
}

const dados = lerResultado()
let total = 0, falhas = []
if (dados) {
  const testes = (dados.suites ?? []).flatMap(s => coletarTestes(s))
  total = testes.length
  falhas = testes.filter(t => !t.ok).map(t => t.titulo)
}

const tudoOk = dados !== null && falhas.length === 0
const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date())

// Se passou tudo e não é pra mandar sempre, não envia nada.
if (tudoOk && !SEMPRE) {
  console.log(`Tudo OK (${total} telas). E-mail não enviado (SMOKE_ALWAYS != true).`)
  process.exit(0)
}

const cor = tudoOk ? '#16a34a' : '#dc2626'
const titulo = dados === null
  ? '❓ Verificação não rodou'
  : tudoOk
    ? `✅ Play Dog OK — ${total} telas`
    : `⚠️ Play Dog — ${falhas.length} tela(s) com problema`

const listaFalhas = falhas.length
  ? `<ul style="margin:8px 0;padding-left:20px;color:#dc2626;">${falhas.map(f => `<li>${f}</li>`).join('')}</ul>`
  : ''

const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
  <div style="background:${cor};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
    <h2 style="margin:0;font-size:18px;">${titulo}</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Verificação diária automática — ${hoje}</p>
  </div>
  <div style="border:1px solid #eee;border-top:0;padding:16px 20px;border-radius:0 0 12px 12px;font-size:14px;color:#333;">
    <p style="margin:0 0 8px;">${dados === null
      ? 'A verificação não produziu resultado — pode ter falhado antes de rodar (login ou rede).'
      : tudoOk
        ? `Todas as ${total} telas do sistema abriram normalmente, sem erros.`
        : `${falhas.length} de ${total} telas apresentaram problema:`}</p>
    ${listaFalhas}
    ${RUN_URL ? `<p style="margin:12px 0 0;"><a href="${RUN_URL}" style="color:#8A05BE;">Ver detalhes da execução →</a></p>` : ''}
  </div>
</div>`

if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY ausente — não foi possível enviar e-mail.')
  console.log(titulo)
  process.exit(0)
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: [TO], subject: `[Play Dog] ${titulo}`, html }),
})

if (res.ok) {
  console.log(`E-mail enviado: ${titulo}`)
} else {
  console.error(`Falha ao enviar e-mail: ${res.status} ${await res.text()}`)
}
