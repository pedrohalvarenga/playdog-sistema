import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BYTES = 12 * 1024 * 1024 // 12 MB
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Categorias e áreas válidas do sistema (a IA deve devolver exatamente uma destas)
const CATEGORIAS = [
  'racao_petiscos', 'limpeza', 'produtos_banho_tosa', 'salarios', 'comissoes',
  'combustivel', 'manutencao', 'investimento', 'aluguel', 'agua_luz_internet',
  'contador', 'marketing', 'impostos', 'taxas_bancarias', 'vacinas_veterinario', 'outros',
]
const AREAS = ['creche', 'hotel', 'loja', 'banho_tosa', 'transporte', 'veterinario', 'outros', 'geral']

const PROMPT = `Você é o assistente financeiro da Play Dog, uma creche/hotel/banho&tosa/transporte/veterinário para cães em Juiz de Fora (MG). Sua tarefa é ler uma FATURA DE CARTÃO DE CRÉDITO e extrair CADA compra, classificando-a nas categorias e áreas do sistema.

Retorne APENAS um JSON válido neste formato exato (sem markdown, sem explicação antes ou depois):
{
  "itens": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "texto curto e legível da compra",
      "valor": 0.00,
      "categoria": "uma das categorias válidas",
      "area": "uma das áreas válidas",
      "confianca": "alta" | "media" | "baixa"
    }
  ]
}

CATEGORIAS válidas (use exatamente uma destas strings): ${CATEGORIAS.join(', ')}
ÁREAS válidas (use exatamente uma destas strings): ${AREAS.join(', ')}

Guia de classificação (baseado nos fornecedores reais da Play Dog):
- Postos de combustível, gasolina, etanol, "posto", Shell, Ipiranga, BR → categoria "combustivel", área "transporte"
- Ração, petiscos, Budopet, Natuka, pet shop de insumos → categoria "racao_petiscos", área "creche"
- Shampoo, perfume, produtos de banho, cosmético animal → categoria "produtos_banho_tosa", área "banho_tosa"
- Vacinas, Mouragro, produtos veterinários, medicamentos → categoria "vacinas_veterinario", área "veterinario"
- Material de limpeza, desinfetante, Bahamas/supermercado (itens de limpeza) → categoria "limpeza", área "geral"
- Cemig (luz), Cesama (água), Vero/internet, telefone → categoria "agua_luz_internet", área "geral"
- Material de construção, ferragem, reforma, peças, conserto → categoria "manutencao", área "geral"
- Anúncios, tráfego pago, Meta/Google Ads, marketing, impressão → categoria "marketing", área "geral"
- Compra de equipamento durável (celular, computador, móvel, máquina) → categoria "investimento", área "geral"
- Impostos, DAS, DARF, FGTS, guia, taxa governamental → categoria "impostos", área "geral"
- Tarifa bancária, anuidade, IOF, juros → categoria "taxas_bancarias", área "geral"
- Comida/almoço/lanche da equipe, uber, item sem relação clara com pet → categoria "outros", área "outros"
- Quando não tiver certeza da categoria, use "outros" e marque "confianca": "baixa"

REGRAS IMPORTANTES:
- Extraia TODAS as linhas de COMPRA da fatura.
- NÃO inclua: pagamentos da fatura anterior, créditos, estornos, "PAGAMENTO RECEBIDO", "PGTO", saldo anterior, total da fatura. Só compras (valores que a empresa GASTOU).
- valor: número decimal positivo em reais, sem "R$" (ex: 185.95).
- data: data da compra (não a data de vencimento da fatura). Se a fatura só mostrar dia/mês, use o ano da fatura. Formato YYYY-MM-DD.
- descricao: limpe o texto do estabelecimento para ficar legível (ex: "BUDOPET LTDA JUIZ DE FOR" → "Budopet").
- confianca "alta" se a classificação é óbvia; "media" se provável; "baixa" se você chutou.
- Se não conseguir ler nenhuma compra, retorne { "itens": [] }.`

type ItemFatura = {
  data: string | null
  descricao: string
  valor: number
  categoria: string
  area: string
  confianca: string
}

export async function POST(request: Request) {
  // Só usuários logados (consome créditos da API)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('arquivo') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx. 12 MB).' }, { status: 413 })
  }
  const tipo = file.type || ''
  const isPdf = tipo === 'application/pdf'
  if (!isPdf && !TIPOS_IMAGEM.includes(tipo)) {
    return NextResponse.json({ error: 'Formato não suportado. Envie a fatura em PDF ou foto (JPG/PNG).' }, { status: 415 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const midia = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: tipo as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }

  let texto = ''
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: [midia, { type: 'text', text: PROMPT }] }],
    })
    const bloco = msg.content?.[0]
    texto = bloco && bloco.type === 'text' ? bloco.text.trim() : ''
  } catch (e) {
    const m = e instanceof Error ? e.message : 'erro desconhecido'
    return NextResponse.json({ error: 'Falha ao analisar a fatura com a IA: ' + m }, { status: 502 })
  }

  try {
    const clean = texto.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as { itens?: ItemFatura[] }
    const itensRaw = Array.isArray(parsed.itens) ? parsed.itens : []

    // Saneamento: garante categoria/área válidas e valor positivo
    const itens = itensRaw
      .filter(it => typeof it.valor === 'number' && it.valor > 0)
      .map(it => ({
        data: it.data && /^\d{4}-\d{2}-\d{2}$/.test(it.data) ? it.data : null,
        descricao: String(it.descricao ?? '').slice(0, 120),
        valor: Math.round(it.valor * 100) / 100,
        categoria: CATEGORIAS.includes(it.categoria) ? it.categoria : 'outros',
        area: AREAS.includes(it.area) ? it.area : 'geral',
        confianca: ['alta', 'media', 'baixa'].includes(it.confianca) ? it.confianca : 'media',
      }))

    return NextResponse.json({ itens })
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler a fatura', raw: texto.slice(0, 500) }, { status: 422 })
  }
}
