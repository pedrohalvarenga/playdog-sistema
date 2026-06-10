import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { pet_id } = await request.json()

  if (!pet_id) return NextResponse.json({ error: 'pet_id required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('fazer_checkin', {
    p_pet_id: pet_id,
    p_data: hoje,
    p_registrado_por: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ presenca_id: data })
}
