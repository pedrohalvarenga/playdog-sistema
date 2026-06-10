import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { pet_id } = await request.json()

  if (!pet_id) return NextResponse.json({ error: 'pet_id required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const hoje = new Date().toISOString().split('T')[0]

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

  // Decrementa saldo (ignora erro se coluna ainda não existir)
  const { data: pet } = await supabase
    .from('pets')
    .select('saldo_diarias')
    .eq('id', pet_id)
    .single()

  if (pet && typeof pet.saldo_diarias === 'number') {
    await supabase
      .from('pets')
      .update({ saldo_diarias: pet.saldo_diarias - 1 })
      .eq('id', pet_id)
  }

  return NextResponse.json({ presenca_id: presenca.id })
}
