'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Check, X, Percent } from 'lucide-react'
import { formatCurrency, AREA_LABELS } from '@/lib/financeiro'
import { hojeLocal, inicioMes, fimMes } from '@/lib/datas'
import { valorBaseComissao, aliquotaEfetiva, inicioEfetivo, type RegraComissao, type ReceitaComissionavel } from '@/lib/comissoes'
import type { Profile } from '@/types'
import type { ContaFinanceira, AreaNegocio } from '@/types/financeiro'
import type { Funcionario, ComissaoRegra, ComissaoPaga } from '@/types/funcionario'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface DetalheComissao {
  area: AreaNegocio
  descricao: string
  valor: number
}

interface LinhaFunc {
  funcionario: Funcionario
  detalhes: DetalheComissao[]
  receitas: ReceitaComissionavel[]
  totalComissao: number
}

export default function ComissoesPage() {
  const router = useRouter()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [linhas, setLinhas] = useState<LinhaFunc[]>([])
  const [pagas, setPagas] = useState<ComissaoPaga[]>([])
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [loading, setLoading] = useState(true)

  // Modal pagamento
  const [pagando, setPagando] = useState<LinhaFunc | null>(null)
  const [contaPag, setContaPag] = useState('')
  const [dataPag, setDataPag] = useState('')
  const [salvandoPag, setSalvandoPag] = useState(false)

  const mesRef = `${ano}-${String(mes + 1).padStart(2, '0')}`

  const navMes = (dir: number) => {
    const d = new Date(ano, mes + dir, 1)
    setMes(d.getMonth())
    setAno(d.getFullYear())
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }

    const inicio = inicioMes(mesRef)
    const fim = fimMes(mesRef)

    const [funcRes, regrasRes, recRes, fatRes, presRes, pagasRes, contasRes] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('recebe_comissao', true).order('nome'),
      supabase.from('comissao_regras').select('*'),
      supabase.from('receitas')
        .select('id, data, valor, valor_liquido, area, descricao, executado_por, pet:pets(nome)')
        .eq('status', 'pago').gte('data', inicio).lte('data', fim)
        .not('executado_por', 'is', null),
      // Faturamento do mês por área (todo o pet shop) — base do escalonamento de %.
      supabase.from('receitas').select('area, valor, valor_liquido')
        .eq('status', 'pago').gte('data', inicio).lte('data', fim),
      // Presenças da creche no mês (comissão fixa por presença).
      supabase.from('presencas').select('data').gte('data', inicio).lte('data', fim),
      supabase.from('comissoes_pagas').select('*').eq('mes_referencia', mesRef),
      supabase.from('contas_financeiras').select('*').eq('ativo', true),
    ])

    const funcs = (funcRes.data as Funcionario[]) ?? []
    const regras = (regrasRes.data as ComissaoRegra[]) ?? []
    const receitas = (recRes.data as unknown as (ReceitaComissionavel & { executado_por: string })[]) ?? []
    const presencasDatas = ((presRes.data as { data: string }[]) ?? []).map(p => p.data)

    // Faturamento (bruto) do mês por área — usado no escalonamento (ex.: banho & tosa > 10k).
    const faturamentoPorArea: Record<string, number> = {}
    for (const r of (fatRes.data as { area: AreaNegocio; valor: number }[]) ?? []) {
      faturamentoPorArea[r.area] = (faturamentoPorArea[r.area] ?? 0) + Number(r.valor)
    }

    const linhasCalc: LinhaFunc[] = funcs.map(f => {
      const regrasF: RegraComissao[] = regras
        .filter(r => r.funcionario_id === f.id)
        .map(r => ({
          tipo: r.tipo,
          tipo_calculo: r.tipo_calculo ?? 'percentual',
          percentual: Number(r.percentual),
          faturamento_limite: r.faturamento_limite ?? null,
          percentual_acima: r.percentual_acima ?? null,
          valor_fixo: r.valor_fixo ?? null,
          vigencia_inicio: r.vigencia_inicio ?? null,
        }))
      const recsFunc = receitas.filter(r => r.executado_por === f.id)
      const detalhes: DetalheComissao[] = []

      for (const regra of regrasF) {
        if (regra.tipo_calculo === 'por_presenca_creche') {
          const ini = inicioEfetivo(regra, inicio)
          const n = presencasDatas.filter(d => d >= ini && d <= fim).length
          const valor = Math.round(n * (regra.valor_fixo ?? 0) * 100) / 100
          if (n > 0) detalhes.push({
            area: regra.tipo,
            descricao: `${n} presença${n !== 1 ? 's' : ''} na creche × ${formatCurrency(regra.valor_fixo ?? 0)}`,
            valor,
          })
        } else {
          const recsArea = recsFunc.filter(r => r.area === regra.tipo)
          const base = recsArea.reduce((s, r) => s + valorBaseComissao(r), 0)
          if (base > 0) {
            const fatArea = faturamentoPorArea[regra.tipo] ?? 0
            const aliq = aliquotaEfetiva(regra, fatArea)
            const valor = Math.round(base * aliq / 100 * 100) / 100
            const escalonou = regra.faturamento_limite != null && fatArea > regra.faturamento_limite
            const nota = regra.faturamento_limite != null
              ? (escalonou ? ` · faturamento acima de ${formatCurrency(regra.faturamento_limite)}` : ` · até ${formatCurrency(regra.faturamento_limite)}`)
              : ''
            detalhes.push({
              area: regra.tipo,
              descricao: `${AREA_LABELS[regra.tipo]}: ${aliq}% de ${formatCurrency(base)}${nota}`,
              valor,
            })
          }
        }
      }
      const total = Math.round(detalhes.reduce((s, d) => s + d.valor, 0) * 100) / 100
      return { funcionario: f, detalhes, receitas: recsFunc, totalComissao: total }
    })

    setLinhas(linhasCalc)
    setPagas((pagasRes.data as ComissaoPaga[]) ?? [])
    setContas((contasRes.data as ContaFinanceira[]) ?? [])
    setLoading(false)
  }, [mes, ano, mesRef, router])

  useEffect(() => { carregar() }, [carregar])

  function jaPago(funcId: string): ComissaoPaga | undefined {
    return pagas.find(p => p.funcionario_id === funcId)
  }

  function abrirPagamento(l: LinhaFunc) {
    setPagando(l)
    setContaPag(contas[0]?.id ?? '')
    setDataPag(hojeLocal())
  }

  async function registrarPagamento() {
    if (!pagando || pagando.totalComissao <= 0) return
    setSalvandoPag(true)
    const supabase = createClient()
    const nomeMes = `${MESES[mes]}/${ano}`

    // Atrela a comissão à ÁREA que a gerou (banho_tosa, creche, etc.), não a
    // "geral". Quando há mais de uma área, gera uma despesa por área para o DRE
    // atribuir o custo corretamente.
    const porArea = new Map<AreaNegocio, number>()
    for (const d of pagando.detalhes) {
      if (d.valor > 0) porArea.set(d.area, (porArea.get(d.area) ?? 0) + d.valor)
    }
    const linhas = [...porArea.entries()].map(([area, valor]) => ({
      data: dataPag,
      valor: Math.round(valor * 100) / 100,
      area,
      categoria: 'comissoes' as const,
      conta_id: contaPag || null,
      descricao: porArea.size > 1
        ? `Comissão ${pagando.funcionario.nome} — ${nomeMes} (${AREA_LABELS[area]})`
        : `Comissão ${pagando.funcionario.nome} — ${nomeMes}`,
      status: 'pago' as const,
      data_pagamento: dataPag,
      recorrente: false,
      funcionario_id: pagando.funcionario.id,
      mes_referencia: mesRef,
    }))

    const { data: despesasInseridas, error: errDesp } = await supabase
      .from('despesas').insert(linhas).select('id')

    if (errDesp) { setSalvandoPag(false); alert(`Erro ao lançar despesa: ${errDesp.message}`); return }
    const despesa = despesasInseridas?.[0] ?? null

    const { error: errPaga } = await supabase.from('comissoes_pagas').insert({
      funcionario_id: pagando.funcionario.id,
      mes_referencia: mesRef,
      valor_total: pagando.totalComissao,
      despesa_id: despesa?.id ?? null,
    })

    setSalvandoPag(false)
    if (errPaga) {
      alert(errPaga.message.includes('duplicate') || errPaga.message.includes('unique')
        ? 'Esse mês já foi pago para este funcionário.'
        : `Erro: ${errPaga.message}`)
      return
    }
    setPagando(null)
    carregar()
  }

  const totalGeral = linhas.reduce((s, l) => s + l.totalComissao, 0)

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/funcionarios" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Comissões</h1>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-4 py-3">
        <button onClick={() => navMes(-1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700"><ChevronLeft size={20} /></button>
        <span className="font-semibold text-gray-800 capitalize">{MESES[mes]} {ano}</span>
        <button onClick={() => navMes(1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700"><ChevronRight size={20} /></button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* Total geral */}
          <div className="bg-gradient-to-r from-brand-purple to-purple-600 rounded-2xl px-5 py-4 text-white">
            <p className="text-sm opacity-80">Total de comissões — {MESES[mes]} {ano}</p>
            <p className="text-3xl font-bold mt-0.5">{formatCurrency(totalGeral)}</p>
            <p className="text-xs opacity-70 mt-1">{linhas.length} funcionário{linhas.length !== 1 ? 's' : ''} com comissão</p>
          </div>

          {linhas.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Percent size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum funcionário recebe comissão</p>
              <p className="text-xs mt-1">Ative &quot;Recebe comissão&quot; na ficha do funcionário.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {linhas.map(l => {
                const paga = jaPago(l.funcionario.id)
                return (
                  <Card key={l.funcionario.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{l.funcionario.nome}</p>
                        {l.funcionario.salario > 0 && (
                          <p className="text-xs text-gray-400">Salário base {formatCurrency(l.funcionario.salario)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Comissão</p>
                        <p className="font-bold text-teal-600">{formatCurrency(l.totalComissao)}</p>
                      </div>
                    </div>

                    {l.detalhes.length > 0 ? (
                      <div className="flex flex-col gap-1 bg-gray-50 rounded-xl px-3 py-2">
                        {l.detalhes.map((d, i) => (
                          <div key={i} className="flex justify-between gap-3 text-xs">
                            <span className="text-gray-500 min-w-0">{d.descricao}</span>
                            <span className="font-semibold text-gray-700 flex-shrink-0">{formatCurrency(d.valor)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Sem comissão a pagar neste mês.</p>
                    )}

                    {paga && (
                      <div className="bg-green-50 rounded-xl px-3 py-2 text-xs text-green-700 font-semibold flex items-center gap-1.5">
                        <Check size={14} /> Comissão paga ({formatCurrency(paga.valor_total)})
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link href={`/funcionarios/${l.funcionario.id}/extrato?mes=${mesRef}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-brand-purple text-brand-purple font-semibold text-sm">
                        <FileText size={15} /> Extrato PDF
                      </Link>
                      {!paga && (
                        <button onClick={() => abrirPagamento(l)} disabled={l.totalComissao <= 0}
                          className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white font-semibold text-sm disabled:opacity-40">
                          Registrar pagamento
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal pagamento */}
      {pagando && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setPagando(null)}>
          <div className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Pagar comissão</h2>
              <button onClick={() => setPagando(null)} className="p-2 rounded-xl text-gray-400"><X size={22} /></button>
            </div>

            <div className="bg-teal-50 rounded-2xl px-4 py-3 text-center">
              <p className="text-xs text-teal-700">{pagando.funcionario.nome} · {MESES[mes]}/{ano}</p>
              <p className="text-2xl font-bold text-teal-700">{formatCurrency(pagando.totalComissao)}</p>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Será lançada uma despesa de &quot;Comissões&quot; no financeiro vinculada a este funcionário.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Data</label>
              <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Conta de origem</label>
              <div className="flex flex-col gap-2">
                {contas.map(c => (
                  <button key={c.id} type="button" onClick={() => setContaPag(c.id)}
                    className={`py-2.5 px-4 rounded-2xl text-sm font-semibold border-2 text-left ${
                      contaPag === c.id ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
                    }`}>
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>

            <Button size="lg" onClick={registrarPagamento} loading={salvandoPag}>
              <Check size={18} /> Confirmar pagamento
            </Button>
          </div>
        </div>
      )}

      <div className="pb-6" />
    </div>
  )
}
