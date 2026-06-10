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
            text: `Você é um assistente que analisa cupons fiscais de abastecimento de combustível.
Extraia os dados do comprovante e retorne APENAS um JSON válido neste formato exato (sem markdown, sem explicação):
{
  "valor_total": 0.00,
  "valor_litro": 0.000,
  "litros": 0.000,
  "km": 0,
  "data": "YYYY-MM-DD"
}

Regras:
- valor_total: valor total pago em reais (número decimal, ex: 120.50)
- valor_litro: preço por litro do combustível (número decimal, ex: 5.989)
- litros: quantidade de litros abastecidos (número decimal, ex: 20.100)
- km: quilometragem do painel ou hodômetro se aparecer no cupom (número inteiro, ou null se não aparecer)
- data: data do abastecimento no formato YYYY-MM-DD (ou null se não aparecer)
- Se um campo não estiver visível no cupom, use null (sem aspas)
- Não inclua símbolos de moeda, apenas números`,
          },
        ],
      },
    ],
  })

  const texto = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  try {
    const clean = texto.replace(/```json|```/g, '').trim()
    const dados = JSON.parse(clean)
    return NextResponse.json(dados)
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o comprovante', raw: texto }, { status: 422 })
  }
}
