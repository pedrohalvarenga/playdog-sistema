import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/financeiro/StatusBadge'
import PendenciaActions from '@/components/financeiro/PendenciaActions'
import AdminLancamentoActions from '@/components/financeiro/AdminLancamentoActions'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, AREA_CORES, CATEGORIA_DESPESA_LABELS, isInvestimento } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Despesa } from '@/types/financeiro'

export default async function DespesaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin) redirect('/financeiro')

  const { data } = await supabase
    .from('despesas')
    .select('*, conta:contas_financeiras(nome), parcelamento:parcelamentos(descricao, num_parcelas)')
    .eq('id', id)
    .single<Despesa>()

  if (!data) notFound()
  const d = data

  const rows: { label: string; value: string }[] = [
    { label: 'Data', value: formatDate(d.data) },
    { label: 'Área', value: AREA_LABELS[d.area] },
    { label: 'Categoria', value: CATEGORIA_DESPESA_LABELS[d.categoria] },
    { label: 'Conta', value: d.conta?.nome ?? '—' },
    { label: 'Valor', value: formatCurrency(d.valor) },
    ...(d.fornecedor ? [{ label: 'Fornecedor', value: d.fornecedor }] : []),
    ...(d.descricao ? [{ label: 'Descrição', value: d.descricao }] : []),
    ...(d.data_vencimento ? [{ label: 'Vencimento', value: formatDate(d.data_vencimento) }] : []),
    { label: 'Recorrente', value: d.recorrente ? `Sim (dia ${d.dia_vencimento})` : 'Não' },
    ...(d.parcelamento ? [
      { label: 'Contrato', value: d.parcelamento.descricao ?? '' },
      { label: 'Parcela', value: `${d.num_parcela} de ${d.parcelamento.num_parcelas}` },
    ] : []),
  ]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/despesas" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Despesa</h1>
        <StatusBadge status={d.status} dataVencimento={d.data_vencimento} />
      </div>

      {isInvestimento(d.categoria) && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-2xl p-3 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">Investimento — não conta no resultado operacional</p>
        </div>
      )}

      <Card>
        <div className={`inline-flex self-start text-[10px] px-2 py-0.5 rounded-full font-semibold mb-2 ${AREA_CORES[d.area]}`}>
          {AREA_LABELS[d.area]}
        </div>
        <p className="text-3xl font-bold text-red-600">−{formatCurrency(d.valor)}</p>
        <p className="text-sm text-gray-500">{d.descricao || CATEGORIA_DESPESA_LABELS[d.categoria]}</p>
      </Card>

      <Card className="divide-y divide-gray-100">
        {rows.map(row => (
          <div key={row.label} className="flex justify-between py-2.5 gap-3">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-sm font-medium text-gray-800 text-right">{row.value}</span>
          </div>
        ))}
      </Card>

      {d.status === 'pendente' && (
        <div className="flex justify-center">
          <PendenciaActions id={d.id} tipo="despesa" />
        </div>
      )}

      <AdminLancamentoActions id={d.id} tipo="despesa" voltarPara="/financeiro/despesas" />
    </div>
  )
}
