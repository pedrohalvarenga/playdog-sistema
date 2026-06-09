import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('arquivo') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Você é um assistente veterinário. Analise este cartão de vacinação de cachorro e extraia as datas das vacinas.

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
- Giardia = vacina_giardia`,
          },
        ],
      },
    ],
  })

  const texto = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  try {
    // Remove possíveis blocos de markdown se o modelo desobedecer
    const clean = texto.replace(/```json|```/g, '').trim()
    const dados = JSON.parse(clean)
    return NextResponse.json(dados)
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o cartão', raw: texto }, { status: 422 })
  }
}
