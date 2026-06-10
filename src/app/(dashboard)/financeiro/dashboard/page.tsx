import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, CreditCard, Banknote, AlertTriangle, Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import DashboardCharts from '@/components/financeiro/DashboardCharts'
import { formatCurrency, AREA_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { SaldoConta } from '@/types/financeiro'

const COR_AREA: Record<string, string> = {
  creche: '#a855f7', hotel: '#3b82f6', loja: '#22c55e',
  banho_tosa: '#ec4899', transporte: '#f97316', outros: '#9ca3af', geral: '#64748b',
}

export default async function FinanceiroDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const hoje = new Date()
  const anoHoje = hoje.getFullYear()
  const mesHoje = hoje.getMonth() + 1

  // Saldos de contas
  const { data: saldos } = await supabase.from('v_saldo_contas').select('*').returns<SaldoConta[]>()
  const saldoTotal = (saldos ?? []).reduce((s, c) => s + c.saldo_atual, 0)

  // Totais do mês atual
  const inicioMes = `${anoHoje}-${String(mesHoje).padStart(2, '0')}-01`
  const fimMes = new Date(anoHoje, mesHoje, 0).toISOString().split('T')[0]

  const [{ data: recMes }, { data: despMes }] = await Promise.all([
    supabase.from('receitas').select('valor, valor_liquido, area').gte('data', inicioMes).lte('data', fimMes).eq('status', 'pago'),
    supabase.from('despesas').select('valor, area, categoria').gte('data', inicioMes).lte('data', fimMes).eq('status', 'pago'),
  ])

  const totalEntradas = (recMes ?? []).reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)
  const totalSaidas = (despMes ?? []).filter(d => d.categoria !== 'investimento').reduce((s, d) => s + d.valor, 0)
  const resultadoMes = totalEntradas - totalSaidas

  // Histórico 12 meses
  const inicio12 = new Date(anoHoje, mesHoje - 13, 1)
  const inicio12Str = `${inicio12.getFullYear()}-${String(inicio12.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: rec12 }, { data: desp12 }] = await Promise.all([
    supabase.from('receitas').select('data, valor, valor_liquido').gte('data', inicio12Str).eq('status', 'pago'),
    supabase.from('despesas').select('data, valor, categoria').gte('data', inicio12Str).eq('status', 'pago'),
  ])

  // Agrega por mês (últimos 12)
  const meses12: { label: string; receitas: number; despesas: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anoHoje, mesHoje - 1 - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    const receitas = (rec12 ?? [])
      .filter(r => r.data.startsWith(ym))
      .reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)
    const despesas = (desp12 ?? [])
      .filter(r => r.data.startsWith(ym) && r.categoria !== 'investimento')
      .reduce((s, r) => s + r.valor, 0)
    meses12.push({ label, receitas, despesas })
  }

  // Receita por área (mês atual)
  const recPorArea: Record<string, number> = {}
  for (const r of recMes ?? []) recPorArea[r.area] = (recPorArea[r.area] ?? 0) + (r.valor_liquido ?? r.valor)
  const receitasPorArea = Object.entries(recPorArea)
    .map(([area, valor]) => ({ label: AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area, valor, cor: COR_AREA[area] ?? '#9ca3af' }))
    .sort((a, b) => b.valor - a.valor)

  // Despesa por área (mês atual, não-investimento)
  const despPorArea: Record<string, number> = {}
  for (const d of despMes ?? []) {
    if (d.categoria === 'investimento') continue
    despPorArea[d.area] = (despPorArea[d.area] ?? 0) + d.valor
  }
  const despesasPorArea = Object.entries(despPorArea)
    .map(([area, valor]) => ({ label: AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area, valor, cor: COR_AREA[area] ?? '#9ca3af' }))
    .sort((a, b) => b.valor - a.valor)

  // Inadimplência: receitas pendentes vencidas por tutor
  const hojeStr = hoje.toISOString().split('T')[0]
  const { data: inadimplentes } = await supabase
    .from('receitas')
    .select('valor, data_vencimento, tutor:tutores(nome)')
    .eq('status', 'pendente')
    .lt('data_vencimento', hojeStr)
    .order('data_vencimento')
    .limit(10)

  // Pacotes vencendo em 15 dias
  const em15 = new Date(); em15.setDate(em15.getDate() + 15)
  const em15Str = em15.toISOString().split('T')[0]
  const { data: pacotes } = await supabase
    .from('receitas')
    .select('valor, data_vencimento, descricao, tutor:tutores(nome)')
    .in('categoria', ['pacote_mensal', 'pacote_semanal'])
    .eq('status', 'pendente')
    .gte('data_vencimento', hojeStr)
    .lte('data_vencimento', em15Str)
    .order('data_vencimento')
    .limit(10)

  const mesNome = hoje.toLocaleDateString('pt-BR', { month: 'long' })
  const contaIcones: Record<string, React.ElementType> = { pagbank_pj: CreditCard, c6_pf: Wallet, dinheiro: Banknote }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 capitalize">{mesNome} {anoHoje}</p>
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center py-3">
          <TrendingUp size={16} className="text-green-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400">Entradas</p>
          <p className="font-bold text-xs text-green-600">{formatCurrency(totalEntradas)}</p>
        </Card>
        <Card className="text-center py-3">
          <TrendingDown size={16} className="text-red-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400">Saídas</p>
          <p className="font-bold text-xs text-red-600">{formatCurrency(totalSaidas)}</p>
        </Card>
        <Card className={`text-center py-3 ${resultadoMes >= 0 ? 'bg-purple-50' : 'bg-red-50'}`}>
          <Wallet size={16} className={`mx-auto mb-1 ${resultadoMes >= 0 ? 'text-brand-purple' : 'text-red-500'}`} />
          <p className="text-[10px] text-gray-400">Resultado</p>
          <p className={`font-bold text-xs ${resultadoMes >= 0 ? 'text-brand-purple' : 'text-red-600'}`}>
            {formatCurrency(resultadoMes)}
          </p>
        </Card>
      </div>

      {/* Saldos de contas */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Saldo das contas</p>
        <Card className="bg-gradient-to-br from-brand-purple to-purple-700 text-white border-0 mb-2">
          <p className="text-sm opacity-80">Saldo consolidado</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(saldoTotal)}</p>
        </Card>
        <div className="flex flex-col gap-2">
          {(saldos ?? []).map(c => {
            const Icon = contaIcones[c.tipo] ?? Wallet
            return (
              <Card key={c.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-brand-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{c.nome}</p>
                  <p className={`font-bold text-sm ${c.saldo_atual >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatCurrency(c.saldo_atual)}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Gráficos */}
      <DashboardCharts
        historico={meses12}
        receitasPorArea={receitasPorArea}
        despesasPorArea={despesasPorArea}
      />

      {/* Pacotes vencendo */}
      {(pacotes ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Pacotes vencendo em 15 dias ({pacotes!.length})
          </p>
          <div className="flex flex-col gap-2">
            {pacotes!.map((p, i) => (
              <Card key={i} className="flex items-center gap-3 py-3 border-l-4 border-l-yellow-400">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {(p.tutor as { nome?: string } | null)?.nome ?? 'Tutor não identificado'}
                  </p>
                  <p className="text-xs text-gray-400">{p.descricao ?? 'Pacote'} · vence {p.data_vencimento}</p>
                </div>
                <span className="font-bold text-sm text-yellow-600 flex-shrink-0">{formatCurrency(p.valor)}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inadimplência */}
      {(inadimplentes ?? []).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">
              Inadimplência ({inadimplentes!.length})
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {inadimplentes!.map((r, i) => (
              <Card key={i} className="flex items-center gap-3 py-3 border-l-4 border-l-red-400">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {(r.tutor as { nome?: string } | null)?.nome ?? 'Tutor não identificado'}
                  </p>
                  <p className="text-xs text-red-400">Venceu em {r.data_vencimento}</p>
                </div>
                <span className="font-bold text-sm text-red-600 flex-shrink-0">{formatCurrency(r.valor)}</span>
              </Card>
            ))}
          </div>
          <Link href="/financeiro/pendencias" className="block text-center text-xs text-brand-purple font-semibold mt-2">
            Ver todas as pendências →
          </Link>
        </div>
      )}
    </div>
  )
}
