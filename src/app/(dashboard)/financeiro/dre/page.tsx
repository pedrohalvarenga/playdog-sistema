import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Wrench, Info } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatCurrency, AREA_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { AreaNegocio, ResultadoArea } from '@/types/financeiro'

const AREAS_OPERACIONAIS: AreaNegocio[] = ['creche', 'hotel', 'loja', 'banho_tosa', 'transporte', 'outros']

export default async function DREPage({
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
  const [ano, mesNum] = mesAtual.split('-').map(Number)
  const inicio = `${mesAtual}-01`
  const fim = new Date(ano, mesNum, 0).toISOString().split('T')[0]
  const nomeMes = new Date(ano, mesNum - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const mesAnterior = new Date(ano, mesNum - 2, 1)
  const mesSeguinte = new Date(ano, mesNum, 1)
  const fmtMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  // Busca receitas e despesas do mês
  const [{ data: receitas }, { data: despesas }] = await Promise.all([
    supabase.from('receitas')
      .select('area, valor, valor_liquido, taxa_cartao, status')
      .gte('data', inicio).lte('data', fim).eq('status', 'pago'),
    supabase.from('despesas')
      .select('area, valor, categoria, status')
      .gte('data', inicio).lte('data', fim).eq('status', 'pago'),
  ])

  // Calcula totais de despesas "geral" para rateio
  const despesasGeral = (despesas ?? []).filter(d => d.area === 'geral' && d.categoria !== 'investimento')
  const totalGeralOp = despesasGeral.reduce((s, d) => s + d.valor, 0)
  const investimentosGeral = (despesas ?? [])
    .filter(d => d.area === 'geral' && d.categoria === 'investimento')
    .reduce((s, d) => s + d.valor, 0)

  // Receita bruta por área (para calcular proporção do rateio)
  const receitaBrutaPorArea: Record<string, number> = {}
  for (const r of receitas ?? []) {
    receitaBrutaPorArea[r.area] = (receitaBrutaPorArea[r.area] ?? 0) + r.valor
  }
  const totalReceitaNaoGeral = AREAS_OPERACIONAIS.reduce((s, a) => s + (receitaBrutaPorArea[a] ?? 0), 0)

  // Monta DRE por área
  const dre: ResultadoArea[] = AREAS_OPERACIONAIS.map(area => {
    const receitaBruta = receitaBrutaPorArea[area] ?? 0
    const taxasCartao = (receitas ?? [])
      .filter(r => r.area === area && r.taxa_cartao)
      .reduce((s, r) => s + (r.valor - (r.valor_liquido ?? r.valor)), 0)
    const despesasDiretas = (despesas ?? [])
      .filter(d => d.area === area && d.categoria !== 'investimento')
      .reduce((s, d) => s + d.valor, 0)
    const investimentos = (despesas ?? [])
      .filter(d => d.area === area && d.categoria === 'investimento')
      .reduce((s, d) => s + d.valor, 0)
    const proporcao = totalReceitaNaoGeral > 0 ? receitaBruta / totalReceitaNaoGeral : 0
    const rateioGeral = Math.round(totalGeralOp * proporcao * 100) / 100
    const resultado = receitaBruta - taxasCartao - despesasDiretas - rateioGeral

    return { area, receita_bruta: receitaBruta, taxas_cartao: taxasCartao, despesas_diretas: despesasDiretas, investimentos, rateio_geral: rateioGeral, resultado }
  })

  const totalResultado = dre.reduce((s, a) => s + a.resultado, 0)
  const totalReceitaBruta = dre.reduce((s, a) => s + a.receita_bruta, 0)

  // Linha "Geral" separada para mostrar no rodapé
  const geralDespesasOp = totalGeralOp
  const geralInvestimentos = investimentosGeral

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">DRE por Área</h1>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3">
        <Link href={`?mes=${fmtMes(mesAnterior)}`} className="text-brand-purple font-bold text-lg px-2">‹</Link>
        <p className="font-semibold text-gray-800 capitalize text-sm">{nomeMes}</p>
        <Link href={`?mes=${fmtMes(mesSeguinte)}`} className="text-brand-purple font-bold text-lg px-2">›</Link>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="text-center py-3">
          <TrendingUp size={16} className="text-green-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400">Receita total</p>
          <p className="font-bold text-sm text-green-600">{formatCurrency(totalReceitaBruta)}</p>
        </Card>
        <Card className={`text-center py-3 ${totalResultado >= 0 ? 'bg-purple-50' : 'bg-red-50'}`}>
          {totalResultado >= 0
            ? <TrendingUp size={16} className="text-brand-purple mx-auto mb-1" />
            : <TrendingDown size={16} className="text-red-500 mx-auto mb-1" />}
          <p className="text-[10px] text-gray-400">Resultado total</p>
          <p className={`font-bold text-sm ${totalResultado >= 0 ? 'text-brand-purple' : 'text-red-600'}`}>
            {formatCurrency(totalResultado)}
          </p>
        </Card>
      </div>

      {/* Info rateio */}
      {totalGeralOp > 0 && (
        <div className="flex items-start gap-2 bg-slate-50 rounded-2xl p-3 border border-slate-200">
          <Info size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            {formatCurrency(totalGeralOp)} em despesas gerais rateadas proporcionalmente ao faturamento de cada área.
          </p>
        </div>
      )}

      {/* DRE por área */}
      <div className="flex flex-col gap-3">
        {dre.map(a => (
          <Card key={a.area} className={a.receita_bruta === 0 && a.despesas_diretas === 0 ? 'opacity-40' : ''}>
            {/* Cabeçalho da área */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[a.area]}`}>
                {AREA_LABELS[a.area]}
              </span>
              <span className={`text-sm font-bold ${a.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {a.resultado >= 0 ? '+' : ''}{formatCurrency(a.resultado)}
              </span>
            </div>

            {/* Linhas DRE */}
            <div className="flex flex-col gap-1.5 text-xs">
              <DRERow label="Receita bruta" valor={a.receita_bruta} cor="text-gray-800" bold />
              {a.taxas_cartao > 0 && (
                <DRERow label="(−) Taxas de cartão" valor={-a.taxas_cartao} cor="text-gray-500" />
              )}
              {a.despesas_diretas > 0 && (
                <DRERow label="(−) Despesas diretas" valor={-a.despesas_diretas} cor="text-red-500" />
              )}
              {a.rateio_geral > 0 && (
                <DRERow label="(−) Rateio gerais" valor={-a.rateio_geral} cor="text-slate-500" italic />
              )}
              <div className="border-t border-gray-100 pt-1.5 flex justify-between">
                <span className="font-semibold text-gray-700">= Resultado operacional</span>
                <span className={`font-bold ${a.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(a.resultado)}
                </span>
              </div>
              {a.investimentos > 0 && (
                <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-amber-200">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Wrench size={10} /> Investimentos (fora do resultado)
                  </span>
                  <span className="text-amber-600 font-semibold">{formatCurrency(a.investimentos)}</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Despesas gerais (rateadas acima) */}
      {(geralDespesasOp > 0 || geralInvestimentos > 0) && (
        <Card className="border-dashed">
          <p className="text-xs font-semibold text-slate-500 mb-2">Despesas Gerais (rateadas acima)</p>
          <div className="flex flex-col gap-1.5 text-xs">
            {geralDespesasOp > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Operacionais rateadas</span>
                <span className="font-semibold text-slate-700">{formatCurrency(geralDespesasOp)}</span>
              </div>
            )}
            {geralInvestimentos > 0 && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-amber-600"><Wrench size={10} /> Investimentos</span>
                <span className="font-semibold text-amber-600">{formatCurrency(geralInvestimentos)}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Comparativo rápido */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Comparativo de áreas</p>
        <Card>
          <div className="flex flex-col gap-2">
            {dre
              .filter(a => a.receita_bruta > 0 || a.despesas_diretas > 0)
              .sort((a, b) => b.resultado - a.resultado)
              .map(a => {
                const maxAbs = Math.max(...dre.map(x => Math.abs(x.resultado)), 1)
                const pct = Math.round((Math.abs(a.resultado) / maxAbs) * 100)
                return (
                  <div key={a.area} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">{AREA_LABELS[a.area]}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${a.resultado >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-20 text-right flex-shrink-0 ${a.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(a.resultado)}
                    </span>
                  </div>
                )
              })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function DRERow({ label, valor, cor, bold, italic }: { label: string; valor: number; cor: string; bold?: boolean; italic?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`${cor} ${italic ? 'italic' : ''} ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`${cor} ${bold ? 'font-bold' : 'font-medium'}`}>
        {valor < 0 ? `−${formatCurrency(Math.abs(valor))}` : formatCurrency(valor)}
      </span>
    </div>
  )
}
