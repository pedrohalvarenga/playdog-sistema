'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { OrcamentoPeriodo, AreaNegocio } from '@/types/financeiro'

export async function salvarOrcamento(fd: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const area        = fd.get('area') as AreaNegocio
  const periodo     = fd.get('periodo') as OrcamentoPeriodo
  const ano         = parseInt(fd.get('ano') as string)
  const mes         = fd.get('mes') ? parseInt(fd.get('mes') as string) : null
  const trimestre   = fd.get('trimestre') ? parseInt(fd.get('trimestre') as string) : null
  const semestre    = fd.get('semestre') ? parseInt(fd.get('semestre') as string) : null
  const meta_receita = parseFloat((fd.get('meta_receita') as string).replace(',', '.') || '0')
  const teto_despesa = parseFloat((fd.get('teto_despesa') as string).replace(',', '.') || '0')

  // Upsert: tenta atualizar existente, senão cria.
  // Usa .is(col, null) para campos nulos — .eq(col, null) nunca casa no PostgREST.
  let q = supabase
    .from('orcamentos')
    .select('id')
    .eq('area', area).eq('periodo', periodo).eq('ano', ano)
  q = mes === null ? q.is('mes', null) : q.eq('mes', mes)
  q = trimestre === null ? q.is('trimestre', null) : q.eq('trimestre', trimestre)
  q = semestre === null ? q.is('semestre', null) : q.eq('semestre', semestre)
  const { data: existente } = await q.maybeSingle()

  if (existente) {
    await supabase.from('orcamentos').update({
      meta_receita, teto_despesa, updated_at: new Date().toISOString(),
    }).eq('id', existente.id)
  } else {
    await supabase.from('orcamentos').insert({
      area, periodo, ano, mes, trimestre, semestre,
      meta_receita, teto_despesa, registrado_por: user.id,
    })
  }

  const params = new URLSearchParams({ periodo, ano: String(ano) })
  if (mes) params.set('mes', String(mes))
  redirect(`/financeiro/orcamento?${params.toString()}`)
}
