import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Wallet, CreditCard, Banknote,
  AlertCircle, Clock, ArrowRight, LayoutGrid,
  BarChart2, PieChart, Target, LineChart, Dog,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { SaldoConta, Receita, Despesa } from '@/types/financeiro'

function ContaCard({ conta }: { conta: SaldoConta }) {
  const icones: Record<string, React.ElementType> = {
    pagbank_pj: CreditCard,
    c6_pf:      Wallet,
    dinheiro:   Banknote,
  }
  const Icon = icones[conta.tipo] ?? Wallet
  const positivo = conta.saldo_atual >= 0
  return (
    <Card className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-brand-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 truncate">{conta.nome}</p>
        <p className={`font-bold text-lg ${positivo ? 'text-gray-900' : 'text-red-600'}`}>
          {formatCurrency(conta.saldo_atual)}
        </p>
      </div>
    </Card>
  )
}

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'

  // Busca saldos
  const { data: saldos } = await supabase
    .from('v_saldo_contas')
    .select('*')
    .returns<SaldoConta[]>()

  const saldoConsolidado = (saldos ?? []).reduce((s, c) => s + c.saldo_atual, 0)

  // Totais do mês atual
  const hoje = new Date()
  const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: receitasMes }, { data: despesasMes }] = await Promise.all([
    supabase.from('receitas')
      .select('valor, valor_liquido, status')
      .gte('data', inicioMes)
      .eq('status', 'pago'),
    isAdmin
      ? supabase.from('despesas').select('valor, status, categoria').gte('data', inicioMes).eq('status', 'pago')
      : Promise.resolve({ data: [] }),
  ])

  const totalReceitasMes = (receitasMes ?? []).reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)
  const totalDespesasMes = (despesasMes ?? []).reduce((s: number, d: { valor: number; status: string; categoria: string }) => {
    if (d.categoria === 'investimento') return s
    return s + d.valor
  }, 0)
  const resultadoMes = totalReceitasMes - totalDespesasMes

  // Pendências urgentes (vencidas ou a vencer em 7 dias)
  const emSete = new Date(); emSete.setDate(emSete.getDate() + 7)
  const emSeteStr = emSete.toISOString().split('T')[0]
  const hojeStr = hoje.toISOString().split('T')[0]

  const [{ data: receitasPend }, { data: despesasPend }] = await Promise.all([
    supabase.from('receitas')
      .select('id, descricao, valor, data_vencimento, area')
      .eq('status', 'pendente')
      .lte('data_vencimento', emSeteStr)
      .order('data_vencimento'),
    isAdmin
      ? supabase.from('despesas')
          .select('id, descricao, valor, data_vencimento, area, categoria')
          .eq('status', 'pendente')
          .lte('data_vencimento', emSeteStr)
          .order('data_vencimento')
      : Promise.resolve({ data: [] }),
  ])

  const totalPendencias = (receitasPend?.length ?? 0) + (despesasPend?.length ?? 0)

  // Últimos lançamentos
  const { data: ultimasReceitas } = await supabase.from('receitas')
    .select('id, data, valor, valor_liquido, categoria, area, status, descricao, forma_pagamento')
    .order('created_at', { ascending: false }).limit(5)

  const mesNome = hoje.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500 capitalize">{mesNome} {hoje.getFullYear()}</p>
        </div>
        <Link href="/financeiro/pendencias" className="relative">
          <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Clock size={20} className="text-gray-600" />
          </div>
          {totalPendencias > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalPendencias > 9 ? '9+' : totalPendencias}
            </span>
          )}
        </Link>
      </div>

      {/* Saldo consolidado */}
      <Card className="bg-gradient-to-br from-brand-purple to-purple-700 text-white border-0">
        <p className="text-sm opacity-80">Saldo total consolidado</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(saldoConsolidado)}</p>
        <p className="text-xs opacity-70 mt-2">Soma de todas as contas</p>
      </Card>

      {/* Saldos por conta */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Por conta</p>
        <div className="flex flex-col gap-2">
          {(saldos ?? []).map(c => <ContaCard key={c.id} conta={c} />)}
        </div>
      </div>

      {/* Resumo do mês */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resultado do mês</p>
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center">
            <TrendingUp size={18} className="text-green-500 mx-auto mb-1" />
            <p className="text-[11px] text-gray-500">Receitas</p>
            <p className="font-bold text-sm text-green-600">{formatCurrency(totalReceitasMes)}</p>
          </Card>
          <Card className="text-center">
            <TrendingDown size={18} className="text-red-500 mx-auto mb-1" />
            <p className="text-[11px] text-gray-500">Despesas</p>
            <p className="font-bold text-sm text-red-600">{formatCurrency(totalDespesasMes)}</p>
          </Card>
          <Card className="text-center">
            <LayoutGrid size={18} className={`mx-auto mb-1 ${resultadoMes >= 0 ? 'text-brand-purple' : 'text-red-500'}`} />
            <p className="text-[11px] text-gray-500">Resultado</p>
            <p className={`font-bold text-sm ${resultadoMes >= 0 ? 'text-brand-purple' : 'text-red-600'}`}>
              {formatCurrency(resultadoMes)}
            </p>
          </Card>
        </div>
      </div>

      {/* Acesso rápido */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lançamentos</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/financeiro/receitas', label: 'Receitas', icon: TrendingUp, cor: 'bg-green-50 text-green-700' },
            ...(isAdmin ? [
              { href: '/financeiro/despesas', label: 'Despesas', icon: TrendingDown, cor: 'bg-red-50 text-red-700' },
              { href: '/financeiro/parcelamentos', label: 'Dívidas', icon: Wallet, cor: 'bg-blue-50 text-blue-700' },
              { href: '/financeiro/conciliacao', label: 'Conciliação', icon: CreditCard, cor: 'bg-orange-50 text-orange-700' },
            ] : []),
            { href: '/financeiro/pendencias', label: 'Pendências', icon: AlertCircle, cor: totalPendencias > 0 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700' },
          ].map(m => (
            <Link key={m.href} href={m.href}>
              <Card className={`flex items-center gap-3 ${m.cor}`}>
                <m.icon size={20} />
                <span className="font-semibold text-sm">{m.label}</span>
                {m.href === '/financeiro/pendencias' && totalPendencias > 0 && (
                  <span className="ml-auto text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                    {totalPendencias}
                  </span>
                )}
                <ArrowRight size={16} className="ml-auto opacity-60" />
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Análise e Planejamento (admin) */}
      {isAdmin && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Análise & Planejamento</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/financeiro/dashboard',                    label: 'Dashboard',        icon: BarChart2, cor: 'bg-purple-50 text-purple-700' },
              { href: '/financeiro/dre',                         label: 'DRE por Área',     icon: PieChart,  cor: 'bg-indigo-50 text-indigo-700' },
              { href: '/financeiro/orcamento',                   label: 'Orçamento',        icon: Target,    cor: 'bg-teal-50 text-teal-700' },
              { href: '/financeiro/projecao',                    label: 'Projeção',         icon: LineChart, cor: 'bg-orange-50 text-orange-700' },
              { href: '/financeiro/relatorios/faturamento',      label: 'Fat. por Pet/Tutor', icon: Dog,    cor: 'bg-pink-50 text-pink-700' },
            ].map(m => (
              <Link key={m.href} href={m.href}>
                <Card className={`flex items-center gap-3 ${m.cor}`}>
                  <m.icon size={20} />
                  <span className="font-semibold text-sm">{m.label}</span>
                  <ArrowRight size={16} className="ml-auto opacity-60" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Últimas receitas */}
      {(ultimasReceitas ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Últimas receitas</p>
            <Link href="/financeiro/receitas" className="text-xs text-brand-purple font-semibold">Ver tudo</Link>
          </div>
          <div className="flex flex-col gap-2">
            {(ultimasReceitas ?? []).slice(0, 5).map(r => (
              <Card key={r.id} className="flex items-center gap-3 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'pago' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.descricao || r.categoria}</p>
                  <p className="text-xs text-gray-400">{formatDate(r.data)}</p>
                </div>
                <p className="font-bold text-sm text-green-600 flex-shrink-0">
                  +{formatCurrency(r.valor_liquido ?? r.valor)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
