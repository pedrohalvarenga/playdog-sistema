import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json()
  const { tutor, pet } = body

  if (!tutor?.nome || !tutor?.telefone || !pet?.nome) {
    return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Cria o tutor
  const { data: novoTutor, error: errTutor } = await adminClient
    .from('tutores')
    .insert({
      nome: tutor.nome,
      telefone: tutor.telefone,
      cpf: tutor.cpf || null,
      endereco: tutor.endereco || null,
    })
    .select()
    .single()

  if (errTutor) return NextResponse.json({ error: errTutor.message }, { status: 400 })

  // Cria o pet
  const { error: errPet } = await adminClient.from('pets').insert({
    tutor_id: novoTutor.id,
    nome: pet.nome,
    raca: pet.raca || null,
    porte: pet.porte || 'M',
    data_nascimento: pet.data_nascimento || null,
    castrado: pet.castrado || false,
    restricoes: pet.restricoes || null,
    medicacao: pet.medicacao || null,
    plano: pet.plano || 'diaria_avulsa',
    vacina_v8_v10: pet.vacina_v8_v10 || null,
    vacina_antirabica: pet.vacina_antirabica || null,
    vacina_gripe: pet.vacina_gripe || null,
    vacina_giardia: pet.vacina_giardia || null,
    ativo: true,
  })

  if (errPet) return NextResponse.json({ error: errPet.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
