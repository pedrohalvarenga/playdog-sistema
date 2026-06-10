import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json()
  const { tutor } = body
  // Aceita tanto { pet } (formato antigo) quanto { pets: [...] } (vários cães)
  const pets = Array.isArray(body.pets) ? body.pets : body.pet ? [body.pet] : []

  if (!tutor?.nome || !tutor?.telefone || pets.length === 0 || pets.some((p: any) => !p?.nome)) {
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

  // Cria todos os pets
  const { error: errPet } = await adminClient.from('pets').insert(
    pets.map((pet: any) => ({
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
      foto_url: pet.foto_url || null,
      ativo: true,
    }))
  )

  if (errPet) return NextResponse.json({ error: errPet.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
