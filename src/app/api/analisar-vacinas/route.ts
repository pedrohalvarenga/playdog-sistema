import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const PROMPT = `Você é um assistente veterinário. Analise este cartão de vacinação de cachorro e extraia as datas das vacinas.

Retorne APENAS um JSON válido neste formato exato (sem markdown, sem explicação):
{
  "vacina_v8_v10": "YYYY-MM-DD ou null",
  "vacina_antirabica": "YYYY-MM-DD ou null",
  "vacina_gripe": "YYYY-MM-DD ou null",
  "vacina_giardia": "YYYY-MM-DD ou null"
}

Regras:
- Use sempre a data da ÚLTIMA dose aplicada de cada vacina
- Se uma vacina não estiver no cartão, use null (sem aspas)
- Datas devem estar no formato YYYY-MM-DD
- V8, V10, polivalente, múltipla = vacina_v8_v10
- Antirrábica, raiva = vacina_antirabica
- Gripe, tosse dos canis, Bordetella, parainfluenza = vacina_gripe
- Giardia = vacina_giardia`

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('arquivo') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  // Validações de segurança (rota pública): tamanho e tipo
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx. 8 MB).' }, { status: 413 })
  }
  const tipo = file.type || ''
  const isPdf = tipo === 'application/pdf'
  if (!isPdf && !TIPOS_IMAGEM.includes(tipo)) {
    return NextResponse.json({ error: 'Formato não suportado. Envie uma foto (JPG/PNG) ou PDF.' }, { status: 415 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  // PDF vai como bloco "document"; imagem como "image"
  const midia = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: tipo as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }

  let texto = ''
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: [midia, { type: 'text', text: PROMPT }] }],
    })
    const bloco = msg.content?.[0]
    texto = bloco && bloco.type === 'text' ? bloco.text.trim() : ''
  } catch (e) {
    const m = e instanceof Error ? e.message : 'erro desconhecido'
    return NextResponse.json({ error: 'Falha ao analisar o cartão com a IA: ' + m }, { status: 502 })
  }

  try {
    const clean = texto.replace(/```json|```/g, '').trim()
    const dados = JSON.parse(clean)
    return NextResponse.json(dados)
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o cartão', raw: texto }, { status: 422 })
  }
}
