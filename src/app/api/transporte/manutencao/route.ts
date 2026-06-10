import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Registro simples de manutenção do veículo (recepção/admin) com
// despesa automática na área transporte, categoria manutenção.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, ativo').eq('id', user.id).single()
  if (!profile?.ativo || !['admin', 'recepcao'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { data, descricao, valor, km } = await request.json()
  const v = parseFloat(String(valor ?? '').replace(',', '.'))
  if (!data || !descricao?.trim() || isNaN(v) || v <= 0) {
    return NextResponse.json({ error: 'Preencha data, descrição e valor.' }, { status: 400 })
  }
  const kmNum = km != null && String(km).trim() !== '' ? parseFloat(String(km).replace(',', '.')) : null

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: despesa, error: errDesp } = await admin.from('despesas').insert({
    data,
    valor: v,
    area: 'transporte',
    categoria: 'manutencao',
    descricao: `Manutenção veículo — ${descricao.trim()}`,
    status: 'pago',
    recorrente: false,
    registrado_por: user.id,
  }).select('id').single()

  if (errDesp) return NextResponse.json({ error: errDesp.message }, { status: 500 })

  const { error: errMan } = await admin.from('manutencoes_veiculo').insert({
    data,
    descricao: descricao.trim(),
    valor: v,
    km: kmNum,
    despesa_id: despesa?.id ?? null,
    registrado_por: user.id,
  })

  if (errMan) return NextResponse.json({ error: errMan.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
