import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, AREA_CORES, CATEGORIA_RECEITA_LABELS, CATEGORIA_DESPESA_LABELS } from '@/lib/financeiro'
import PendenciaActions from '@/components/financeiro/PendenciaActions'
import type { Profile } from '@/types'
import type { Receita, Despesa } from '@/types/financeiro'

export default async function PendenciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  const hoje = new Date().toISOString().split('T')[0]
  const emSete = new Date(); emSete.setDate(emSete.getDate() + 7)
  const emSeteStr = emSete.toISOString().split('T')[0]

  const [{ data: rVencidas }, { data: rUrgentes }, { data: rFuturas }] = await Promise.all([
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome)')
      .eq('status', 'pendente').lt('data_vencimento', hoje).order('data_vencimento'),
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome)')
      .eq('status', 'pendente').gte('data_vencimento', hoje).lte('data_vencimento', emSeteStr).order('data_vencimento'),
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome)')
      .eq('status', 'pendente').gt('data_vencimento', emSeteStr).order('data_vencimento').limit(20),
  ])

  const [{ data: dVencidas }, { data: dUrgentes }, { data: dFuturas }] = isAdmin
    ? await Promise.all([
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').lt('data_vencimento', hoje).order('data_vencimento'),
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').gte('data_vencimento', hoje).lte('data_vencimento', emSeteStr).order('data_vencimento'),
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').gt('data_vencimento', emSeteStr).order('data_vencimento').limit(20),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  function GrupoItem({ item, tipo }: { item: Receita | Despesa; tipo: 'receita' | 'despesa' }) {
    const isR = tipo === 'receita'
    const r = item as Receita
    const d = item as Despesa
    return (
      <Card className={`flex items-center gap-3 ${isR ? '' : 'border-l-4 border-l-red-300'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[item.area]}`}>
              {AREA_LABELS[item.area]}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isR ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isR ? 'Receita' : 'Despesa'}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">
            {item.descricao || (isR ? CATEGORIA_RECEITA_LABELS[r.categoria] : CATEGORIA_DESPESA_LABELS[d.categoria])}
          </p>
          <p className="text-xs text-gray-400">
            Vence {item.data_vencimento ? formatDate(item.data_vencimento) : '—'}
            {isR && r.tutor?.nome ? ` · ${r.tutor.nome}` : ''}
            {!isR && d.fornecedor ? ` · ${d.fornecedor}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <p className={`font-bold text-sm ${isR ? 'text-green-600' : 'text-red-600'}`}>
            {isR ? '+' : '−'}{formatCurrency(isR ? (r.valor_liquido ?? r.valor) : d.valor)}
          </p>
          <PendenciaActions id={item.id} tipo={tipo} />
        </div>
      </Card>
    )
  }

  const grupos = [
    {
      titulo: '🔴 Vencidos',
      items: [
        ...(rVencidas ?? []).map(i => ({ item: i as Receita, tipo: 'receita' as const })),
        ...(dVencidas ?? []).map(i => ({ item: i as Despesa, tipo: 'despesa' as const })),
      ].sort((a, b) => (a.item.data_vencimento ?? '').localeCompare(b.item.data_vencimento ?? '')),
    },
    {
      titulo: '🟡 Vence em 7 dias',
      items: [
        ...(rUrgentes ?? []).map(i => ({ item: i as Receita, tipo: 'receita' as const })),
        ...(dUrgentes ?? []).map(i => ({ item: i as Despesa, tipo: 'despesa' as const })),
      ].sort((a, b) => (a.item.data_vencimento ?? '').localeCompare(b.item.data_vencimento ?? '')),
    },
    {
      titulo: '⚪ Próximas',
      items: [
        ...(rFuturas ?? []).map(i => ({ item: i as Receita, tipo: 'receita' as const })),
        ...(dFuturas ?? []).map(i => ({ item: i as Despesa, tipo: 'despesa' as const })),
      ].sort((a, b) => (a.item.data_vencimento ?? '').localeCompare(b.item.data_vencimento ?? '')),
    },
  ]

  const total = grupos.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Pendências</h1>
        {total > 0 && (
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-bold">{total}</span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <Clock size={40} strokeWidth={1.5} />
          <p className="text-sm font-medium">Nenhuma pendência!</p>
          <p className="text-xs">Tudo em dia 🎉</p>
        </div>
      ) : (
        grupos.map(g => g.items.length > 0 && (
          <div key={g.titulo} className="flex flex-col gap-2">
            <p className="text-sm font-bold text-gray-700">{g.titulo}</p>
            {g.items.map(({ item, tipo }) => (
              <GrupoItem key={`${tipo}-${item.id}`} item={item} tipo={tipo} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
