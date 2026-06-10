import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatCurrency, AREA_LABELS, AREA_CORES } from '@/lib/financeiro'
import { salvarOrcamento } from './actions'
import type { Profile } from '@/types'
import type { AreaNegocio, OrcamentoPeriodo, Orcamento } from '@/types/financeiro'

const AREAS_OP: AreaNegocio[] = ['creche', 'hotel', 'loja', 'banho_tosa', 'transporte', 'outros']
const PERIODO_LABELS: Record<OrcamentoPeriodo, string> = {
  mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

function barColor(pct: number, isReceita: boolean) {
  if (isReceita) return pct >= 100 ? 'bg-green-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
  // despesa: verde se abaixo do teto, vermelho se estourou
  return pct <= 100 ? 'bg-green-400' : 'bg-red-500'
}

function textColor(pct: number, isReceita: boolean) {
  if (isReceita) return pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500'
  return pct <= 100 ? 'text-green-600' : 'text-red-600'
}

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ano?: string; mes?: string; editando?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const sp = await searchParams
  const hoje = new Date()
  const periodo = (sp.periodo ?? 'mensal') as OrcamentoPeriodo
  const ano = parseInt(sp.ano ?? String(hoje.getFullYear()))
  const mes = sp.mes ? parseInt(sp.mes) : hoje.getMonth() + 1
  const editando = sp.editando as AreaNegocio | undefined

  // Calcula intervalo de datas do período selecionado
  function intervalo(): { inicio: string; fim: string } {
    if (periodo === 'mensal') {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fim = new Date(ano, mes, 0).toISOString().split('T')[0]
      return { inicio, fim }
    }
    if (periodo === 'trimestral') {
      const trim = Math.ceil(mes / 3)
      const mesIni = (trim - 1) * 3 + 1
      return {
        inicio: `${ano}-${String(mesIni).padStart(2, '0')}-01`,
        fim: new Date(ano, mesIni + 2, 0).toISOString().split('T')[0],
      }
    }
    if (periodo === 'semestral') {
      const sem = mes <= 6 ? 1 : 2
      const mesIni = (sem - 1) * 6 + 1
      return {
        inicio: `${ano}-${String(mesIni).padStart(2, '0')}-01`,
        fim: new Date(ano, mesIni + 5, 0).toISOString().split('T')[0],
      }
    }
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
  }

  const { inicio, fim } = intervalo()

  // Busca orçamentos e realizados em paralelo
  const [{ data: orcamentos }, { data: receitasReal }, { data: despesasReal }] = await Promise.all([
    supabase.from('orcamentos').select('*').eq('periodo', periodo).eq('ano', ano)
      .returns<Orcamento[]>(),
    supabase.from('receitas').select('area, valor, valor_liquido').eq('status', 'pago')
      .gte('data', inicio).lte('data', fim),
    supabase.from('despesas').select('area, valor, categoria').eq('status', 'pago')
      .gte('data', inicio).lte('data', fim),
  ])

  // Agrupa realizados por área
  const recReal: Record<string, number> = {}
  for (const r of receitasReal ?? []) recReal[r.area] = (recReal[r.area] ?? 0) + (r.valor_liquido ?? r.valor)
  const despReal: Record<string, number> = {}
  for (const d of despesasReal ?? []) {
    if (d.categoria === 'investimento') continue
    despReal[d.area] = (despReal[d.area] ?? 0) + d.valor
  }

  // Orçamento da área sendo editada (para preencher form)
  const orcEditando = editando ? (orcamentos ?? []).find(o => o.area === editando) : null

  const nomePeriodo = periodo === 'mensal'
    ? new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : `${PERIODO_LABELS[periodo]} ${ano}`

  const trim = Math.ceil(mes / 3)
  const sem = mes <= 6 ? 1 : 2

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Orçamento</h1>
      </div>

      {/* Seletor de período */}
      <Card className="flex flex-col gap-3">
        {/* Tabs período */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['mensal', 'trimestral', 'semestral', 'anual'] as OrcamentoPeriodo[]).map(p => (
            <Link
              key={p}
              href={`?periodo=${p}&ano=${ano}&mes=${mes}`}
              className={`flex-1 text-center text-xs py-1.5 rounded-lg font-semibold transition-colors ${
                periodo === p ? 'bg-white text-brand-purple shadow-sm' : 'text-gray-500'
              }`}
            >
              {PERIODO_LABELS[p]}
            </Link>
          ))}
        </div>

        {/* Seletor de mês/ano */}
        {periodo === 'mensal' && (
          <div className="flex items-center justify-between">
            <Link href={`?periodo=${periodo}&ano=${mes === 1 ? ano - 1 : ano}&mes=${mes === 1 ? 12 : mes - 1}`}
              className="text-brand-purple font-bold text-lg px-2">‹</Link>
            <p className="font-semibold text-gray-700 text-sm capitalize">{nomePeriodo}</p>
            <Link href={`?periodo=${periodo}&ano=${mes === 12 ? ano + 1 : ano}&mes=${mes === 12 ? 1 : mes + 1}`}
              className="text-brand-purple font-bold text-lg px-2">›</Link>
          </div>
        )}
        {periodo !== 'mensal' && (
          <div className="flex items-center justify-between">
            <Link href={`?periodo=${periodo}&ano=${ano - 1}&mes=${mes}`}
              className="text-brand-purple font-bold text-lg px-2">‹</Link>
            <p className="font-semibold text-gray-700 text-sm capitalize">{nomePeriodo}</p>
            <Link href={`?periodo=${periodo}&ano=${ano + 1}&mes=${mes}`}
              className="text-brand-purple font-bold text-lg px-2">›</Link>
          </div>
        )}
      </Card>

      {/* Linhas por área */}
      <div className="flex flex-col gap-3">
        {AREAS_OP.map(area => {
          const orc = (orcamentos ?? []).find(o => o.area === area)
          const metaRec = orc?.meta_receita ?? 0
          const tetoDep = orc?.teto_despesa ?? 0
          const realRec = recReal[area] ?? 0
          const realDep = despReal[area] ?? 0
          const pctRec = metaRec > 0 ? Math.round((realRec / metaRec) * 100) : null
          const pctDep = tetoDep > 0 ? Math.round((realDep / tetoDep) * 100) : null
          const isEditando = editando === area

          return (
            <Card key={area}>
              {/* Cabeçalho */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[area]}`}>
                  {AREA_LABELS[area]}
                </span>
                <Link
                  href={isEditando
                    ? `?periodo=${periodo}&ano=${ano}&mes=${mes}`
                    : `?periodo=${periodo}&ano=${ano}&mes=${mes}&editando=${area}`}
                  className="text-xs text-brand-purple font-semibold flex items-center gap-1"
                >
                  {isEditando ? 'Cancelar' : 'Definir meta'} <ChevronDown size={12} className={isEditando ? 'rotate-180' : ''} />
                </Link>
              </div>

              {/* Comparativo receita */}
              <div className="flex flex-col gap-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Receita</span>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(realRec)}
                      {metaRec > 0 && <span className="text-gray-400"> / {formatCurrency(metaRec)}</span>}
                    </span>
                  </div>
                  {metaRec > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(pctRec!, true)}`}
                          style={{ width: `${Math.min(pctRec!, 100)}%` }}
                        />
                      </div>
                      <span className={`font-bold w-10 text-right ${textColor(pctRec!, true)}`}>{pctRec}%</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Despesas</span>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(realDep)}
                      {tetoDep > 0 && <span className="text-gray-400"> / {formatCurrency(tetoDep)}</span>}
                    </span>
                  </div>
                  {tetoDep > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(pctDep!, false)}`}
                          style={{ width: `${Math.min(pctDep!, 100)}%` }}
                        />
                      </div>
                      <span className={`font-bold w-10 text-right ${textColor(pctDep!, false)}`}>{pctDep}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulário inline */}
              {isEditando && (
                <form action={salvarOrcamento} className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
                  <input type="hidden" name="area" value={area} />
                  <input type="hidden" name="periodo" value={periodo} />
                  <input type="hidden" name="ano" value={ano} />
                  {periodo === 'mensal' && <input type="hidden" name="mes" value={mes} />}
                  {periodo === 'trimestral' && <input type="hidden" name="trimestre" value={trim} />}
                  {periodo === 'semestral' && <input type="hidden" name="semestre" value={sem} />}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Meta de receita (R$)</label>
                      <input
                        name="meta_receita"
                        type="number"
                        step="50"
                        min="0"
                        defaultValue={orcEditando?.meta_receita ?? 0}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Teto de despesa (R$)</label>
                      <input
                        name="teto_despesa"
                        type="number"
                        step="50"
                        min="0"
                        defaultValue={orcEditando?.teto_despesa ?? 0}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-purple text-white rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Salvar meta
                  </button>
                </form>
              )}
            </Card>
          )
        })}
      </div>

      {/* Totais */}
      <Card className="bg-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Totais do período</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500 mb-0.5">Receita realizada</p>
            <p className="font-bold text-green-600 text-base">
              {formatCurrency(Object.values(recReal).reduce((s, v) => s + v, 0))}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Despesas realizadas</p>
            <p className="font-bold text-red-600 text-base">
              {formatCurrency(Object.values(despReal).reduce((s, v) => s + v, 0))}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
