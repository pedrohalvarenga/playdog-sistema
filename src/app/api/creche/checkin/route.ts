import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hojeLocal } from '@/lib/datas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { pet_id } = await request.json()

  if (!pet_id) return NextResponse.json({ error: 'pet_id required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const hoje = hojeLocal()

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
