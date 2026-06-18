import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hojeLocal } from '@/lib/datas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { pet_id, data } = await request.json()

  if (!pet_id) return NextResponse.json({ error: 'pet_id required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Aceita uma data manual (YYYY-MM-DD) para lançar presença esquecida;
  // por padrão, usa o dia de hoje (check-in normal).
  const hoje = typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeLocal()

  // Registra a presença
  const { data: presenca, error: errPresenca } = await supabase
    .from('presencas')
    .insert({
      pet_id,
      data: hoje,
      checkin_at: new Date().toISOString(),
      registrado_por: user.id,
    })
    .select('id')
    .single()

  if (errPresenca) {
    return NextResponse.json({ error: errPresenca.message }, { status: 400 })
  }

  // Decrementa saldo e garante que o pet fique marcado como "creche"
  // (auto-classificação: fazer check-in confirma que o cão frequenta a creche)
  const { data: pet } = await supabase
    .from('pets')
    .select('saldo_diarias, areas_servico')
    .eq('id', pet_id)
    .single()

  if (pet) {
    const update: { saldo_diarias?: number; areas_servico?: string[] } = {}
    if (typeof pet.saldo_diarias === 'number') {
      update.saldo_diarias = pet.saldo_diarias - 1
    }
    const areas: string[] = Array.isArray(pet.areas_servico) ? pet.areas_servico : []
    if (!areas.includes('creche')) {
      update.areas_servico = [...areas, 'creche']
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('pets').update(update).eq('id', pet_id)
    }
  }

  return NextResponse.json({ presenca_id: presenca.id })
}

// Desfaz um check-in feito por engano: apaga a presença e devolve a diária.
// Diferente do checkout (que registra a saída de uma visita real).
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { presenca_id } = await request.json()

  if (!presenca_id) return NextResponse.json({ error: 'presenca_id required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Busca a presença para saber qual pet teve a diária descontada
  const { data: presenca, error: errBusca } = await supabase
    .from('presencas')
    .select('id, pet_id')
    .eq('id', presenca_id)
    .single()

  if (errBusca || !presenca) {
    return NextResponse.json({ error: 'presença não encontrada' }, { status: 404 })
  }

  // Apaga o registro de presença. Usa .select() para confirmar que a
  // linha realmente saiu — se o RLS bloquear (sem policy de DELETE), o
  // delete não dá erro mas remove 0 linhas; nesse caso NÃO devolvemos a
  // diária, para não inflar o saldo deixando a presença no banco.
  const { data: apagadas, error: errDel } = await supabase
    .from('presencas')
    .delete()
    .eq('id', presenca_id)
    .select('id')

  if (errDel) {
    return NextResponse.json({ error: errDel.message }, { status: 400 })
  }
  if (!apagadas || apagadas.length === 0) {
    return NextResponse.json(
      { error: 'Não foi possível apagar a presença (permissão). Aplique presencas_delete_policy.sql no Supabase.' },
      { status: 403 }
    )
  }

  // Devolve a diária que o check-in havia descontado
  const { data: pet } = await supabase
    .from('pets')
    .select('saldo_diarias')
    .eq('id', presenca.pet_id)
    .single()

  if (pet && typeof pet.saldo_diarias === 'number') {
    await supabase
      .from('pets')
      .update({ saldo_diarias: pet.saldo_diarias + 1 })
      .eq('id', presenca.pet_id)
  }

  return NextResponse.json({ ok: true })
}
