import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Login por primeiro nome: resolve o nome digitado para o e-mail do
// funcionário. Compara sem acentos e sem maiúsculas, no primeiro nome
// ou no nome completo, somente entre usuários ativos.

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

export async function POST(request: Request) {
  const { nome } = await request.json()
  const busca = normalizar(String(nome ?? ''))
  if (!busca || busca.length < 2) {
    return NextResponse.json({ error: 'Informe o nome ou e-mail.' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: perfis, error } = await admin
    .from('profiles')
    .select('email, nome')
    .eq('ativo', true)

  if (error) return NextResponse.json({ error: 'Erro ao buscar usuário.' }, { status: 500 })

  const matches = (perfis ?? []).filter(p => {
    const completo = normalizar(p.nome)
    const primeiro = completo.split(/\s+/)[0]
    return primeiro === busca || completo === busca
  })

  if (matches.length === 1) {
    return NextResponse.json({ email: matches[0].email })
  }
  if (matches.length > 1) {
    return NextResponse.json(
      { error: 'Há mais de um funcionário com esse nome — entre com o e-mail.' },
      { status: 409 }
    )
  }
  return NextResponse.json({ error: 'Nome não encontrado.' }, { status: 404 })
}
