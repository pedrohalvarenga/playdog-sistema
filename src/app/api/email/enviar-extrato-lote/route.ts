import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { mes, ano } = await request.json()
  if (!mes || !ano) return NextResponse.json({ error: 'mes e ano são obrigatórios' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = new Date(ano, mes, 0).toISOString().split('T')[0]

  // Tutores com e-mail e que tiveram movimentação no período
  const { data: tutoresComEmail } = await supabase
    .from('tutores')
    .select('id, nome, email')
    .not('email', 'is', null)
    .neq('email', '')

  if (!tutoresComEmail || tutoresComEmail.length === 0) {
    return NextResponse.json({ resultados: [], message: 'Nenhum tutor com e-mail' })
  }

  const resultados: { tutor: string; email: string; status: 'ok' | 'erro'; erro?: string }[] = []

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const tutor of tutoresComEmail) {
    // Verifica se teve movimentação no período
    const { data: pets } = await supabase.from('pets').select('id').eq('tutor_id', tutor.id)
    const petIds = pets?.map((p: { id: string }) => p.id) ?? []

    if (petIds.length > 0) {
      const { count } = await supabase
        .from('presencas')
        .select('*', { count: 'exact', head: true })
        .in('pet_id', petIds)
        .gte('data', inicio)
        .lte('data', fim)

      if ((count ?? 0) === 0) continue
    } else {
      continue
    }

    try {
      const res = await fetch(`${baseUrl}/api/email/enviar-extrato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_id: tutor.id, mes, ano }),
      })

      if (res.ok) {
        resultados.push({ tutor: tutor.nome, email: tutor.email, status: 'ok' })
      } else {
        const err = await res.json()
        resultados.push({ tutor: tutor.nome, email: tutor.email, status: 'erro', erro: err.error })
      }
    } catch (err) {
      resultados.push({ tutor: tutor.nome, email: tutor.email, status: 'erro', erro: String(err) })
    }
  }

  return NextResponse.json({ resultados })
}
