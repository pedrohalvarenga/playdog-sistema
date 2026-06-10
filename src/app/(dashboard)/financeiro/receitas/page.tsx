import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ArrowLeft, TrendingUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/financeiro/StatusBadge'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, CATEGORIA_RECEITA_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Receita } from '@/types/financeiro'

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const supabase = await createClient()
  const hoje = new Date()
  const mesAtual = mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [ano, mesNum] = mesAtual.split('-')
  const inicio = `${mesAtual}-01`
  const fim = new Date(Number(ano), Number(mesNum), 0).toISOString().split('T')[0]

  const { data: receitas } = await supabase
    .from('receitas')
    .select('*, conta:contas_financeiras(nome), tutor:tutores(nome), pet:pets(nome)')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })

  const lista = (receitas ?? []) as Receita[]
  const totalBruto = lista.reduce((s, r) => s + r.valor, 0)
  const totalLiquido = lista.reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)
  const totalPago = lista.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)

  // Navegação de mês
  const [a, m] = mesAtual.split('-').map(Number)
  const mesAnterior = new Date(a, m - 2, 1)
  const mesSeguinte = new Date(a, m, 1)
  const fmtMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const nomeMes = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Receitas</h1>
        <Link href="/financeiro/receitas/nova">
          <div className="w-10 h-10 rounded-2xl bg-brand-purple text-white flex items-center justify-center">
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
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center py-3">
          <p className="text-[10px] text-gray-400">Bruto</p>
          <p className="font-bold text-sm text-gray-800">{formatCurrency(totalBruto)}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-[10px] text-gray-400">Líquido</p>
          <p className="font-bold text-sm text-green-600">{formatCurrency(totalLiquido)}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-[10px] text-gray-400">Recebido</p>
          <p className="font-bold text-sm text-brand-purple">{formatCurrency(totalPago)}</p>
        </Card>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <TrendingUp size={40} strokeWidth={1.5} />
          <p className="text-sm">Nenhuma receita em {nomeMes}</p>
          <Link href="/financeiro/receitas/nova" className="text-brand-purple font-semibold text-sm">
            + Lançar receita
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map(r => (
            <Link key={r.id} href={`/financeiro/receitas/${r.id}`}>
              <Card className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[r.area]}`}>
                      {AREA_LABELS[r.area]}
                    </span>
                    <StatusBadge status={r.status} dataVencimento={r.data_vencimento} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {r.descricao || CATEGORIA_RECEITA_LABELS[r.categoria]}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(r.data)} · {r.conta?.nome}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-green-600">+{formatCurrency(r.valor_liquido ?? r.valor)}</p>
                  {r.taxa_cartao && (
                    <p className="text-[10px] text-gray-400">bruto {formatCurrency(r.valor)}</p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
