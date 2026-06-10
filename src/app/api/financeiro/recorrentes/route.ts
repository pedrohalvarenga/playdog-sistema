import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron: executar no 1º dia de cada mês para gerar as despesas recorrentes pendentes
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + 1

  // Busca todas as despesas recorrentes
  const { data: recorrentes, error } = await supabase
    .from('despesas')
    .select('*')
    .eq('recorrente', true)
    .eq('status', 'pago') // só replica despesas já pagas
    .not('dia_vencimento', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!recorrentes || recorrentes.length === 0) {
    return NextResponse.json({ geradas: 0 })
  }

  const inserir: Record<string, unknown>[] = []
  for (const d of recorrentes) {
    // Calcula a data de vencimento deste mês
    const diaVenc = Math.min(d.dia_vencimento, new Date(ano, mes, 0).getDate())
    const dataVenc = `${ano}-${String(mes).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    // Verifica se já existe pendência para este mês (evita duplicata)
    const { data: existe } = await supabase
      .from('despesas')
      .select('id')
      .eq('conta_id', d.conta_id)
      .eq('area', d.area)
      .eq('categoria', d.categoria)
      .eq('data_vencimento', dataVenc)
      .eq('status', 'pendente')
      .limit(1)

    if (!existe || existe.length === 0) {
      inserir.push({
        data: dataVenc,
        data_vencimento: dataVenc,
        valor: d.valor,
        area: d.area,
        categoria: d.categoria,
        conta_id: d.conta_id,
        fornecedor: d.fornecedor,
        descricao: d.descricao,
        status: 'pendente',
        recorrente: true,
        dia_vencimento: d.dia_vencimento,
      })
    }
  }

  if (inserir.length > 0) {
    await supabase.from('despesas').insert(inserir)
  }

  return NextResponse.json({ geradas: inserir.length })
}
