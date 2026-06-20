import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, AREA_CORES, CATEGORIA_RECEITA_LABELS, CATEGORIA_DESPESA_LABELS } from '@/lib/financeiro'
import PendenciaActions from '@/components/financeiro/PendenciaActions'
import AtrasoPanel, { type AtrasoItem } from '@/components/financeiro/AtrasoPanel'
import type { Profile } from '@/types'
import type { Receita, Despesa } from '@/types/financeiro'
import { hojeLocal, diaLocal } from '@/lib/datas'

export default async function PendenciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  const hoje = hojeLocal()
  const emSete = new Date(); emSete.setDate(emSete.getDate() + 7)
  const emSeteStr = diaLocal(emSete)

  const [{ data: rVencidas }, { data: rUrgentes }, { data: rFuturas }, { data: rSemData }] = await Promise.all([
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
      .eq('status', 'pendente').lt('data_vencimento', hoje).order('data_vencimento'),
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
      .eq('status', 'pendente').gte('data_vencimento', hoje).lte('data_vencimento', emSeteStr).order('data_vencimento'),
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
      .eq('status', 'pendente').gt('data_vencimento', emSeteStr).order('data_vencimento').limit(100),
    // Pendentes SEM data de vencimento (ex.: banho & tosa, hotel) — antes ficavam invisíveis
    supabase.from('receitas').select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
      .eq('status', 'pendente').is('data_vencimento', null).order('data', { ascending: false }).limit(100),
  ])

  const [{ data: dVencidas }, { data: dUrgentes }, { data: dFuturas }, { data: dSemData }] = isAdmin
    ? await Promise.all([
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').lt('data_vencimento', hoje).order('data_vencimento'),
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').gte('data_vencimento', hoje).lte('data_vencimento', emSeteStr).order('data_vencimento'),
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').gt('data_vencimento', emSeteStr).order('data_vencimento').limit(100),
        supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
          .eq('status', 'pendente').is('data_vencimento', null).order('data', { ascending: false }).limit(100),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  function GrupoItem({ item, tipo }: { item: Receita | Despesa; tipo: 'receita' | 'despesa' }) {
    const isR = tipo === 'receita'
    const r = item as Receita
    const d = item as Despesa
    const atraso = item.data_vencimento ? diasAtraso(item.data_vencimento) : 0
    const vencido = atraso > 0
    return (
      <Card className={`flex items-center gap-3 ${vencido ? 'border-l-4 border-l-red-400' : isR ? '' : 'border-l-4 border-l-gray-200'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[item.area]}`}>
              {AREA_LABELS[item.area]}
            </span>
            {/* Deixa explícito que ainda NÃO foi pago */}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">
              {isR ? 'A receber' : 'A pagar'}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">
            {item.descricao || (isR ? CATEGORIA_RECEITA_LABELS[r.categoria] : CATEGORIA_DESPESA_LABELS[d.categoria])}
          </p>
          <p className="text-xs text-gray-400">
            {item.data_vencimento ? `Vence ${formatDate(item.data_vencimento)}` : `Lançado ${formatDate(item.data)}`}
            {isR && r.tutor?.nome ? ` · ${r.tutor.nome}` : ''}
            {!isR && d.fornecedor ? ` · ${d.fornecedor}` : ''}
          </p>
          {vencido && (
            <p className="text-[11px] text-red-500 font-semibold mt-0.5">
              ⏰ Venceu há {atraso} {atraso === 1 ? 'dia' : 'dias'}
            </p>
          )}
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
      titulo: '🟠 Sem vencimento definido',
      items: [
        ...(rSemData ?? []).map(i => ({ item: i as Receita, tipo: 'receita' as const })),
        ...(dSemData ?? []).map(i => ({ item: i as Despesa, tipo: 'despesa' as const })),
      ].sort((a, b) => (b.item.data ?? '').localeCompare(a.item.data ?? '')),
    },
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

  // ── Somas em aberto ───────────────────────────────────────
  const valorRec = (r: Receita) => r.valor_liquido ?? r.valor
  const recPendentes = [...(rVencidas ?? []), ...(rUrgentes ?? []), ...(rFuturas ?? []), ...(rSemData ?? [])] as Receita[]
  const despPendentes = [...(dVencidas ?? []), ...(dUrgentes ?? []), ...(dFuturas ?? []), ...(dSemData ?? [])] as Despesa[]
  const totalReceber = recPendentes.reduce((s, r) => s + valorRec(r), 0)
  const totalReceberVencido = (rVencidas as Receita[] ?? []).reduce((s, r) => s + valorRec(r), 0)
  const totalPagar = despPendentes.reduce((s, d) => s + d.valor, 0)
  const totalPagarVencido = (dVencidas as Despesa[] ?? []).reduce((s, d) => s + d.valor, 0)

  // ── Atraso médio por tutor / por pet (dos vencidos em aberto) ──
  const diasAtraso = (venc: string | null | undefined) => {
    if (!venc) return 0
    const d = Math.floor((Date.parse(hoje) - Date.parse(venc)) / 86_400_000)
    return d > 0 ? d : 0
  }
  function agruparAtraso(getNome: (r: Receita) => string): AtrasoItem[] {
    const map = new Map<string, { soma: number; qtd: number; total: number }>()
    for (const r of (rVencidas as Receita[] ?? [])) {
      const nome = getNome(r)
      const cur = map.get(nome) ?? { soma: 0, qtd: 0, total: 0 }
      cur.soma += diasAtraso(r.data_vencimento)
      cur.qtd += 1
      cur.total += valorRec(r)
      map.set(nome, cur)
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, atrasoMedio: Math.round(v.soma / v.qtd), qtd: v.qtd, total: v.total }))
      .sort((a, b) => b.atrasoMedio - a.atrasoMedio)
      .slice(0, 6)
  }
  const atrasoPorTutor = agruparAtraso(r => r.tutor?.nome ?? 'Sem tutor vinculado')
  const atrasoPorPet = agruparAtraso(r => (r.pet as { nome?: string } | undefined)?.nome ?? 'Sem pet vinculado')

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
        <>
        {/* Somatórios em aberto */}
        <div className={`grid gap-3 ${isAdmin && totalPagar > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3">
            <div className="flex items-center gap-1.5 text-green-700">
              <TrendingUp size={15} />
              <p className="text-xs font-semibold uppercase tracking-wide">A receber</p>
            </div>
            <p className="text-2xl font-bold text-green-700 mt-0.5">{formatCurrency(totalReceber)}</p>
            {totalReceberVencido > 0 && (
              <p className="text-xs text-red-500 font-medium mt-0.5">Vencido: {formatCurrency(totalReceberVencido)}</p>
            )}
          </div>
          {isAdmin && totalPagar > 0 && (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
              <div className="flex items-center gap-1.5 text-red-700">
                <TrendingDown size={15} />
                <p className="text-xs font-semibold uppercase tracking-wide">A pagar</p>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-0.5">{formatCurrency(totalPagar)}</p>
              {totalPagarVencido > 0 && (
                <p className="text-xs text-red-500 font-medium mt-0.5">Vencido: {formatCurrency(totalPagarVencido)}</p>
              )}
            </div>
          )}
        </div>

        {/* Atraso médio por tutor / pet */}
        <AtrasoPanel porTutor={atrasoPorTutor} porPet={atrasoPorPet} />
        </>
      )}

      {total > 0 && (
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
