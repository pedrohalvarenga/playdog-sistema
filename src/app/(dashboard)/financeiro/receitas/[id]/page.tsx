import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/financeiro/StatusBadge'
import PendenciaActions from '@/components/financeiro/PendenciaActions'
import AdminLancamentoActions from '@/components/financeiro/AdminLancamentoActions'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import {
  AREA_LABELS, AREA_CORES, CATEGORIA_RECEITA_LABELS,
  FORMA_PAGAMENTO_LABELS,
} from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Receita } from '@/types/financeiro'

export default async function ReceitaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  const isAdmin = profile?.role === 'admin'
  const { data } = await supabase
    .from('receitas')
    .select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
    .eq('id', id)
    .single<Receita>()

  if (!data) notFound()
  const r = data

  const rows: { label: string; value: string }[] = [
    { label: 'Data', value: formatDate(r.data) },
    { label: 'Área', value: AREA_LABELS[r.area] },
    { label: 'Categoria', value: CATEGORIA_RECEITA_LABELS[r.categoria] },
    { label: 'Forma de pagamento', value: FORMA_PAGAMENTO_LABELS[r.forma_pagamento] },
    { label: 'Conta', value: r.conta?.nome ?? '—' },
    { label: 'Valor bruto', value: formatCurrency(r.valor) },
    ...(r.taxa_cartao ? [
      { label: 'Taxa cartão', value: `${r.taxa_cartao}%` },
      { label: 'Valor líquido', value: formatCurrency(r.valor_liquido ?? r.valor) },
    ] : []),
    ...(r.tutor?.nome ? [{ label: 'Tutor', value: r.tutor.nome }] : []),
    ...(r.pet?.nome ? [{ label: 'Pet', value: r.pet.nome }] : []),
    ...(r.num_diarias ? [{ label: 'Diárias', value: `${r.num_diarias} dia${r.num_diarias !== 1 ? 's' : ''}` }] : []),
    ...(r.descricao ? [{ label: 'Descrição', value: r.descricao }] : []),
    ...(r.data_vencimento ? [{ label: 'Vencimento', value: formatDate(r.data_vencimento) }] : []),
  ]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/receitas" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Receita</h1>
        <StatusBadge status={r.status} dataVencimento={r.data_vencimento} />
      </div>

      <Card className="flex flex-col gap-1">
        <div className={`inline-flex self-start text-[10px] px-2 py-0.5 rounded-full font-semibold mb-2 ${AREA_CORES[r.area]}`}>
          {AREA_LABELS[r.area]}
        </div>
        <p className="text-3xl font-bold text-green-600">+{formatCurrency(r.valor_liquido ?? r.valor)}</p>
        <p className="text-sm text-gray-500">{r.descricao || CATEGORIA_RECEITA_LABELS[r.categoria]}</p>
      </Card>

      <Card className="divide-y divide-gray-100">
        {rows.map(row => (
          <div key={row.label} className="flex justify-between py-2.5 gap-3">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-sm font-medium text-gray-800 text-right">{row.value}</span>
          </div>
        ))}
      </Card>

      {r.status === 'pendente' && (
        <div className="flex justify-center">
          <PendenciaActions id={r.id} tipo="receita" />
        </div>
      )}

      {isAdmin && (
        <AdminLancamentoActions id={r.id} tipo="receita" voltarPara="/financeiro/receitas" />
      )}
    </div>
  )
}
