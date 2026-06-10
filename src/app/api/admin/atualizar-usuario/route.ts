import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Admin edita um usuário: nome, perfil, ativo e (opcional) nova senha.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id, nome, role, ativo, senha } = await request.json()
  if (!id || !nome?.trim() || !['admin', 'recepcao', 'banho_tosa', 'motorista'].includes(role)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // Trava de segurança: admin não pode rebaixar ou desativar a si mesmo
  if (id === user.id && (role !== 'admin' || ativo === false)) {
    return NextResponse.json({ error: 'Você não pode remover seu próprio acesso de administrador.' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: errProfile } = await adminClient.from('profiles')
    .update({ nome: nome.trim(), role, ativo: ativo !== false })
    .eq('id', id)
  if (errProfile) return NextResponse.json({ error: errProfile.message }, { status: 400 })

  const authUpdates: Record<string, unknown> = {
    user_metadata: { nome: nome.trim(), role },
  }
  if (senha && String(senha).length >= 6) {
    authUpdates.password = senha
  }
  const { error: errAuth } = await adminClient.auth.admin.updateUserById(id, authUpdates)
  if (errAuth) return NextResponse.json({ error: errAuth.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
