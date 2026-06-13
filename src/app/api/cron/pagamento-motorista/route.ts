import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hojeLocal } from '@/lib/datas'

// Cron semanal (segunda-feira): gera o lançamento pendente do pagamento
// do motorista na área transporte. Valor editável em config_transporte
// (chave pagamento_motorista_valor).

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: config } = await supabase
    .from('config_transporte').select('valor').eq('chave', 'pagamento_motorista_valor').single()
  const valor = parseFloat(config?.valor ?? '350')
  if (isNaN(valor) || valor <= 0) return NextResponse.json({ geradas: 0, motivo: 'valor inválido' })

  const hoje = hojeLocal()
  const descricao = `Pagamento motorista — semana de ${hoje.split('-').reverse().join('/')}`

  // Evita duplicata se o cron rodar duas vezes no mesmo dia
  const { data: existe } = await supabase
    .from('despesas')
    .select('id')
    .eq('area', 'transporte')
    .eq('categoria', 'salarios')
    .eq('data_vencimento', hoje)
    .limit(1)

  if (existe && existe.length > 0) return NextResponse.json({ geradas: 0, motivo: 'já existe' })

  const { error } = await supabase.from('despesas').insert({
    data: hoje,
    data_vencimento: hoje,
    valor,
    area: 'transporte',
    categoria: 'salarios',
    descricao,
    status: 'pendente',
    recorrente: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ geradas: 1, valor })
}
