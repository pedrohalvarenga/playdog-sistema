import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowLeft, TrendingDown, Wrench } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/financeiro/StatusBadge'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, CATEGORIA_DESPESA_LABELS, AREA_CORES, isInvestimento } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Despesa } from '@/types/financeiro'

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const { mes } = await searchParams
  const hoje = new Date()
  const mesAtual = mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [ano, mesNum] = mesAtual.split('-')
  const inicio = `${mesAtual}-01`
  const fim = new Date(Number(ano), Number(mesNum), 0).toISOString().split('T')[0]

  const { data: despesas } = await supabase
    .from('despesas')
    .select('*, conta:contas_financeiras(nome)')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })

  const lista = (despesas ?? []) as Despesa[]
  const operacionais = lista.filter(d => !isInvestimento(d.categoria))
  const investimentos = lista.filter(d => isInvestimento(d.categoria))
  const totalOp = operacionais.reduce((s, d) => s + d.valor, 0)
  const totalInv = investimentos.reduce((s, d) => s + d.valor, 0)

  const [a, m] = mesAtual.split('-').map(Number)
  const mesAnterior = new Date(a, m - 2, 1)
  const mesSeguinte = new Date(a, m, 1)
  const fmtMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const nomeMes = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Despesas</h1>
        <Link href="/financeiro/despesas/nova">
          <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center">
            <Plus size={20} />
          </div>
        </Link>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3">
        <Link href={`?mes=${fmtMes(mesAnterior)}`} className="text-brand-purple font-bold text-lg px-2">‹</Link>
        <p className="font-semibold text-gray-800 capitalize text-sm">{nomeMes}</p>
        <Link href={`?mes=${fmtMes(mesSeguinte)}`} className="text-brand-purple font-bold text-lg px-2">›</Link>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="text-center py-3">
          <p className="text-[10px] text-gray-400">Operacional</p>
          <p className="font-bold text-sm text-red-600">{formatCurrency(totalOp)}</p>
        </Card>
        <Card className="text-center py-3 bg-amber-50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wrench size={12} className="text-amber-600" />
            <p className="text-[10px] text-amber-600">Investimento</p>
          </div>
          <p className="font-bold text-sm text-amber-700">{formatCurrency(totalInv)}</p>
        </Card>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <TrendingDown size={40} strokeWidth={1.5} />
          <p className="text-sm">Nenhuma despesa em {nomeMes}</p>
          <Link href="/financeiro/despesas/nova" className="text-red-500 font-semibold text-sm">
            + Lançar despesa
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map(d => (
            <Link key={d.id} href={`/financeiro/despesas/${d.id}`}>
              <Card className={`flex items-center gap-3 ${isInvestimento(d.categoria) ? 'border-l-4 border-l-amber-400' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[d.area]}`}>
                      {AREA_LABELS[d.area]}
                    </span>
                    <StatusBadge status={d.status} dataVencimento={d.data_vencimento} />
                    {d.recorrente && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                        Recorrente
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {d.descricao || CATEGORIA_DESPESA_LABELS[d.categoria]}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(d.data)} · {d.conta?.nome}</p>
                </div>
                <p className="font-bold text-sm text-red-600 flex-shrink-0">−{formatCurrency(d.valor)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
