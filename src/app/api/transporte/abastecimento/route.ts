import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Registra abastecimento: foto do cupom no storage + despesa automática
// (area transporte, categoria combustível) + linha em abastecimentos.
// Usa service role para a despesa porque o RLS de despesas é admin-only,
// mas só depois de validar a sessão e o perfil do usuário.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, ativo, nome').eq('id', user.id).single()
  if (!profile?.ativo || !['admin', 'recepcao', 'motorista'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const formData = await request.formData()
  const km = parseFloat(String(formData.get('km') ?? '').replace(',', '.'))
  const litros = parseFloat(String(formData.get('litros') ?? '').replace(',', '.'))
  const valor = parseFloat(String(formData.get('valor') ?? '').replace(',', '.'))
  const dataParam = String(formData.get('data') ?? '').trim()
  const arquivo = formData.get('arquivo') as File | null

  if (isNaN(km) || km <= 0 || isNaN(litros) || litros <= 0 || isNaN(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Preencha km, litros e valor.' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Foto do cupom (opcional)
  let cupomUrl: string | null = null
  if (arquivo && arquivo.size > 0) {
    const ext = arquivo.name.split('.').pop() ?? 'jpg'
    const path = `cupons/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const bytes = await arquivo.arrayBuffer()
    const { error: errUp } = await admin.storage
      .from('fotos')
      .upload(path, bytes, { contentType: arquivo.type || 'image/jpeg', upsert: false })
    if (!errUp) {
      cupomUrl = admin.storage.from('fotos').getPublicUrl(path).data.publicUrl
    }
  }

  // Despesa automática na área transporte
  const hoje = new Date().toISOString().split('T')[0]
  const dataAbastecimento = dataParam || hoje
  const { data: despesa, error: errDesp } = await admin.from('despesas').insert({
    data: dataAbastecimento,
    valor,
    area: 'transporte',
    categoria: 'combustivel',
    descricao: `Combustível — ${litros.toFixed(2).replace('.', ',')} L · km ${km} · por ${profile.nome}`,
    status: 'pago',
    recorrente: false,
    registrado_por: user.id,
  }).select('id').single()

  if (errDesp) return NextResponse.json({ error: errDesp.message }, { status: 500 })

  const { error: errAb } = await admin.from('abastecimentos').insert({
    data: dataAbastecimento,
    km_painel: km,
    litros,
    valor_total: valor,
    cupom_url: cupomUrl,
    motorista_id: user.id,
    despesa_id: despesa?.id ?? null,
  })

  if (errAb) return NextResponse.json({ error: errAb.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
