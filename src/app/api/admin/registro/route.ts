import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminClient = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function adminEmpresa() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { erro: 'Sem permissão', status: 403 as const }
  return { empresaId: profile.empresa_id as string | null }
}

export async function PATCH(request: Request) {
  const ctx = await adminEmpresa()
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })

  const { tipo, id, ativo } = await request.json()
  const tabela = tipo === 'pet' ? 'pets' : 'tutores'

  // Restringe à empresa do admin (service-role ignora RLS, então filtramos aqui)
  let q = adminClient.from(tabela).update({ ativo }).eq('id', id)
  if (ctx.empresaId) q = q.eq('empresa_id', ctx.empresaId)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const ctx = await adminEmpresa()
  if ('erro' in ctx) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })

  const { tipo, id } = await request.json()

  if (tipo === 'tutor') {
    // Excluir pets vinculados antes do tutor — restritos à mesma empresa
    let qp = adminClient.from('pets').delete().eq('tutor_id', id)
    if (ctx.empresaId) qp = qp.eq('empresa_id', ctx.empresaId)
    const { error: errPets } = await qp
    if (errPets) return NextResponse.json({ error: errPets.message }, { status: 500 })
  }

  const tabela = tipo === 'pet' ? 'pets' : 'tutores'
  let q = adminClient.from(tabela).delete().eq('id', id)
  if (ctx.empresaId) q = q.eq('empresa_id', ctx.empresaId)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
