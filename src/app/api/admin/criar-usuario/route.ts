import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { nome, email, senha, role, menus, funcionario_id } = await request.json()

  const menusLimpos = Array.isArray(menus) ? menus.filter(m => typeof m === 'string') : null

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await adminClient.from('profiles').upsert({
    id: newUser.user.id,
    email,
    nome,
    role,
    menus: menusLimpos,
    ativo: true,
  })

  // Vincula o login ao funcionário escolhido (se houver)
  if (funcionario_id) {
    await adminClient.from('funcionarios')
      .update({ usuario_id: newUser.user.id })
      .eq('id', funcionario_id)
  }

  return NextResponse.json({ ok: true })
}
