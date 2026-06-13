import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json()
  const { tutor, adaptacao } = body
  // Aceita tanto { pet } (um cão) quanto { pets: [...] } (vários cães)
  const pets = Array.isArray(body.pets) ? body.pets : body.pet ? [body.pet] : []

  if (!tutor?.nome || !tutor?.telefone || pets.length === 0 || pets.some((p: { nome?: string }) => !p?.nome) || !adaptacao?.data || !adaptacao?.hora_entrada) {
    return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Cadastro público roda sem usuário logado — resolve o empresa_id explicitamente
  const { data: empresa, error: errEmpresa } = await adminClient
    .from('empresas')
    .select('id')
    .eq('slug', 'playdog')
    .single()

  if (errEmpresa || !empresa) {
    return NextResponse.json({ error: 'Empresa não configurada' }, { status: 500 })
  }

  // Cria o tutor
  const { data: novoTutor, error: errTutor } = await adminClient
    .from('tutores')
    .insert({
      empresa_id: empresa.id,
      nome: tutor.nome,
      telefone: tutor.telefone,
      cpf: tutor.cpf || null,
      endereco: tutor.endereco || null,
    })
    .select()
    .single()

  if (errTutor) return NextResponse.json({ error: errTutor.message }, { status: 400 })

  // Cria todos os pets
  const { data: novosPets, error: errPet } = await adminClient
    .from('pets')
    .insert(
      pets.map((pet: Record<string, unknown>) => ({
        empresa_id: empresa.id,
        tutor_id: novoTutor.id,
        nome: pet.nome,
        raca: pet.raca || null,
        porte: pet.porte || 'M',
        data_nascimento: pet.data_nascimento || null,
        castrado: pet.castrado || false,
        restricoes: pet.restricoes || null,
        plano: 'diaria_avulsa',
        areas_servico: ['adaptacao'], // cão em prospecção; vira "creche" no 1º check-in
        foto_url: pet.foto_url || null,
        cartao_vacinas_url: pet.cartao_vacinas_url || null,
        ativo: true,
      }))
    )
    .select()

  if (errPet) return NextResponse.json({ error: errPet.message }, { status: 400 })

  // Cria um agendamento de adaptação por pet, no mesmo dia e horário
  const { error: errAdapt } = await adminClient.from('adaptacoes').insert(
    (novosPets ?? []).map(p => ({
      empresa_id: empresa.id,
      pet_id: p.id,
      data: adaptacao.data,
      hora_entrada: adaptacao.hora_entrada,
      hora_saida: adaptacao.hora_saida || null,
      observacoes: p.restricoes || null,
      status: 'agendada',
      origem: 'link',
    }))
  )

  if (errAdapt) return NextResponse.json({ error: errAdapt.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
