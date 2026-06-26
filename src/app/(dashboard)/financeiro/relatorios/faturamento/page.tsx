'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronDown, ChevronUp, Dog, Users, ChevronLeft, ChevronRight,
  Search, X, Download, Share2, CalendarRange, Calendar, Scissors,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CATEGORIA_RECEITA_LABELS, AREA_LABELS } from '@/lib/financeiro'
import type { CategoriaReceita, AreaNegocio } from '@/types/financeiro'
import { formatDate } from '@/lib/utils'
import { diaLocal } from '@/lib/datas'

type Aba = 'pet' | 'tutor'
type Modo = 'mes' | 'periodo'
type AreaFiltro = AreaNegocio | 'todas'
type Regime = 'competencia' | 'caixa'

interface Lancamento {
  id: string
  data: string
  data_pagamento: string | null
  valor: number
  valor_liquido: number | null
  categoria: CategoriaReceita
  area: AreaNegocio
  descricao: string | null
  forma_pagamento: string
  status: string
}

interface RawRow extends Lancamento {
  pet: { id: string; nome: string } | null
  tutor: { id: string; nome: string } | null
}

interface GrupoItem {
  id: string | null
  nome: string
  total: number
  totalPago: number
  totalPendente: number
  lancamentos: Lancamento[]
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Áreas oferecidas no filtro (na ordem que faz sentido para a Play Dog)
const AREAS_FILTRO: AreaNegocio[] = ['creche', 'hotel', 'banho_tosa', 'transporte', 'veterinario', 'loja', 'outros', 'geral']

const valorLiquidoOuBruto = (l: { valor: number; valor_liquido: number | null }) => l.valor_liquido ?? l.valor

export default function FaturamentoPorPage() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [modo, setModo] = useState<Modo>('mes')
  const [dataIni, setDataIni] = useState(diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)))
  const [dataFim, setDataFim] = useState(diaLocal(hoje))
  const [aba, setAba] = useState<Aba>('pet')
  const [areaFiltro, setAreaFiltro] = useState<AreaFiltro>('todas')
  const [regime, setRegime] = useState<Regime>('competencia')
  const [incluirPendentes, setIncluirPendentes] = useState(false)
  const [raw, setRaw] = useState<RawRow[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  // Banhos entregues no período (inclui pagos e por pacote) — contagem por pet/tutor
  const [banhosPet, setBanhosPet] = useState<Record<string, number>>({})
  const [banhosTutor, setBanhosTutor] = useState<Record<string, number>>({})
  const [banhosTotal, setBanhosTotal] = useState(0)

  const navMes = (dir: number) => {
    const d = new Date(ano, mes + dir, 1)
    setMes(d.getMonth())
    setAno(d.getFullYear())
  }

  // Intervalo efetivo da busca
  const inicio = modo === 'mes' ? `${ano}-${String(mes + 1).padStart(2, '0')}-01` : dataIni
  const fim = modo === 'mes' ? diaLocal(new Date(ano, mes + 1, 0)) : dataFim

  const buscar = useCallback(async () => {
    setLoading(true)
    setAberto(null)
    const supabase = createClient()

    const campoDt = regime === 'caixa' ? 'data_pagamento' : 'data'

    let query = supabase
      .from('receitas')
      .select(`
        id, data, data_pagamento, valor, valor_liquido, categoria, area, descricao, forma_pagamento, status,
        pet:pets(id, nome),
        tutor:tutores(id, nome)
      `)
      .gte(campoDt, inicio)
      .lte(campoDt, fim)
      .order(campoDt, { ascending: false })

    if (regime === 'caixa') {
      query = query.not('data_pagamento', 'is', null).eq('status', 'pago')
    } else {
      query = incluirPendentes
        ? query.in('status', ['pago', 'pendente'])
        : query.eq('status', 'pago')
    }

    const { data } = await query
    setRaw((data as unknown as RawRow[]) ?? [])

    // Banhos entregues no mesmo período — contados por pet e por tutor.
    // Inclui banhos pagos e os pagos com crédito do pacote (status 'entregue').
    const { data: banhos } = await supabase
      .from('agendamentos_banho_tosa')
      .select('pet_id, pet:pets(tutor_id)')
      .eq('status', 'entregue')
      .gte('data', inicio)
      .lte('data', fim)

    const porPet: Record<string, number> = {}
    const porTutor: Record<string, number> = {}
    for (const b of (banhos ?? []) as { pet_id: string | null; pet: { tutor_id: string | null } | null }[]) {
      if (b.pet_id) porPet[b.pet_id] = (porPet[b.pet_id] ?? 0) + 1
      const tutorId = b.pet?.tutor_id
      if (tutorId) porTutor[tutorId] = (porTutor[tutorId] ?? 0) + 1
    }
    setBanhosPet(porPet)
    setBanhosTutor(porTutor)
    setBanhosTotal((banhos ?? []).length)

    setLoading(false)
  }, [inicio, fim, incluirPendentes, regime])

  useEffect(() => { buscar() }, [buscar])

  // Agrupa por pet/tutor, já aplicando o filtro de área
  const grupos = useMemo<GrupoItem[]>(() => {
    const map = new Map<string, GrupoItem>()
    for (const r of raw) {
      if (areaFiltro !== 'todas' && r.area !== areaFiltro) continue
      const entidade = aba === 'pet' ? r.pet : r.tutor
      const key = entidade?.id ?? '__sem__'
      const nome = entidade?.nome ?? (aba === 'pet' ? 'Sem pet vinculado' : 'Sem tutor vinculado')
      const valor = valorLiquidoOuBruto(r)

      if (!map.has(key)) {
        map.set(key, { id: key === '__sem__' ? null : key, nome, total: 0, totalPago: 0, totalPendente: 0, lancamentos: [] })
      }
      const g = map.get(key)!
      g.total += valor
      if (r.status === 'pendente') g.totalPendente += valor
      else g.totalPago += valor
      g.lancamentos.push({
        id: r.id, data: r.data, data_pagamento: r.data_pagamento,
        valor: r.valor, valor_liquido: r.valor_liquido,
        categoria: r.categoria, area: r.area, descricao: r.descricao,
        forma_pagamento: r.forma_pagamento, status: r.status,
      })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [raw, aba, areaFiltro])

  const total = grupos.reduce((s, g) => s + g.total, 0)
  const totalPago = grupos.reduce((s, g) => s + g.totalPago, 0)
  const totalPendente = grupos.reduce((s, g) => s + g.totalPendente, 0)
  const totalLancamentos = grupos.reduce((s, g) => s + g.lancamentos.length, 0)
  const ticketMedio = totalLancamentos > 0 ? total / totalLancamentos : 0

  // Busca por nome (mantém o ranking original pela posição em `grupos`)
  const termo = filtro.trim().toLowerCase()
  const gruposVisiveis = grupos
    .map((g, idx) => ({ g, idx }))
    .filter(({ g }) => !termo || g.nome.toLowerCase().includes(termo))

  const periodoLabel = modo === 'mes'
    ? `${MESES[mes]} ${ano}`
    : `${formatDate(inicio)} a ${formatDate(fim)}`
  const regimeLabel = regime === 'caixa' ? 'Caixa' : 'Competência'
  const areaLabel = areaFiltro === 'todas' ? 'Todas as áreas' : AREA_LABELS[areaFiltro]

  // ── Exportar CSV ──────────────────────────────────────────
  function exportarCSV() {
    const linhas: string[] = []
    linhas.push(`Faturamento por ${aba === 'pet' ? 'Pet' : 'Tutor'} - ${periodoLabel} - ${areaLabel}`)
    linhas.push(`${aba === 'pet' ? 'Pet' : 'Tutor'};Lançamentos;Total${incluirPendentes ? ';Pago;A receber' : ''}`)
    for (const g of grupos) {
      const campos = [
        `"${g.nome.replace(/"/g, '""')}"`,
        String(g.lancamentos.length),
        formatCurrency(g.total).replace('R$', '').trim(),
      ]
      if (incluirPendentes) {
        campos.push(formatCurrency(g.totalPago).replace('R$', '').trim())
        campos.push(formatCurrency(g.totalPendente).replace('R$', '').trim())
      }
      linhas.push(campos.join(';'))
    }
    linhas.push(`TOTAL;${totalLancamentos};${formatCurrency(total).replace('R$', '').trim()}`)
    const csv = '﻿' + linhas.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faturamento-${aba}-${inicio}-a-${fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Compartilhar (WhatsApp / nativo) ──────────────────────
  function textoResumo() {
    const linhas: string[] = []
    linhas.push(`*Play Dog — Faturamento por ${aba === 'pet' ? 'Pet' : 'Tutor'}*`)
    linhas.push(`${periodoLabel} · ${areaLabel}`)
    linhas.push(`Total: ${formatCurrency(total)}`)
    if (incluirPendentes) linhas.push(`(Pago ${formatCurrency(totalPago)} · A receber ${formatCurrency(totalPendente)})`)
    linhas.push('')
    grupos.slice(0, 30).forEach((g, i) => {
      linhas.push(`${i + 1}. ${g.nome} — ${formatCurrency(g.total)}`)
    })
    if (grupos.length > 30) linhas.push(`...e mais ${grupos.length - 30}`)
    return linhas.join('\n')
  }

  async function compartilhar() {
    const texto = textoResumo()
    if (navigator.share) {
      try { await navigator.share({ title: 'Faturamento Play Dog', text: texto }); return } catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Faturamento</h1>
        {!loading && grupos.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={exportarCSV} className="p-2 rounded-xl text-gray-400 hover:text-brand-purple" aria-label="Exportar CSV" title="Exportar CSV">
              <Download size={20} />
            </button>
            <button onClick={compartilhar} className="p-2 rounded-xl text-gray-400 hover:text-green-600" aria-label="Compartilhar" title="Compartilhar">
              <Share2 size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Modo: mês x período */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        <button
          onClick={() => setModo('mes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${modo === 'mes' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
        >
          <Calendar size={14} /> Mês
        </button>
        <button
          onClick={() => setModo('periodo')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${modo === 'periodo' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
        >
          <CalendarRange size={14} /> Período
        </button>
      </div>

      {/* Regime: competência x caixa */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        <button
          onClick={() => setRegime('competencia')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${regime === 'competencia' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
        >
          Competência
        </button>
        <button
          onClick={() => setRegime('caixa')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${regime === 'caixa' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}
        >
          Caixa
        </button>
      </div>
      {regime === 'caixa' && (
        <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2 -mt-2">
          Mostra receitas pela data em que o pagamento entrou — ideal para bater com extrato bancário.
        </p>
      )}

      {/* Navegação de mês / intervalo de datas */}
      {modo === 'mes' ? (
        <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-4 py-3">
          <button onClick={() => navMes(-1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-gray-800 capitalize">{MESES[mes]} {ano}</span>
          <button onClick={() => navMes(1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">De</label>
            <input type="date" value={dataIni} max={dataFim} onChange={e => setDataIni(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Até</label>
            <input type="date" value={dataFim} min={dataIni} onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
          </div>
        </div>
      )}

      {/* Abas pet/tutor */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAba('pet')}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
            aba === 'pet' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <Dog size={16} /> Por Pet
        </button>
        <button
          onClick={() => setAba('tutor')}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
            aba === 'tutor' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <Users size={16} /> Por Tutor
        </button>
      </div>

      {/* Filtro por área */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setAreaFiltro('todas')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            areaFiltro === 'todas' ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Todas
        </button>
        {AREAS_FILTRO.map(a => (
          <button
            key={a}
            onClick={() => setAreaFiltro(a)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              areaFiltro === a ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {AREA_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Incluir pendentes — só disponível em regime de competência */}
      {regime === 'competencia' && (
        <button
          onClick={() => setIncluirPendentes(v => !v)}
          className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-4 py-2.5"
        >
          <span className="text-sm font-medium text-gray-700">Incluir contas a receber (pendentes)</span>
          <span className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${incluirPendentes ? 'bg-brand-purple' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${incluirPendentes ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
        </button>
      )}

      {/* Total do período */}
      {!loading && (
        <div className="bg-gradient-to-r from-brand-purple to-purple-600 rounded-2xl px-5 py-4 text-white">
          <p className="text-sm opacity-80">Total — {periodoLabel}{areaFiltro !== 'todas' ? ` · ${areaLabel}` : ''} · {regimeLabel}</p>
          <p className="text-3xl font-bold mt-0.5">{formatCurrency(total)}</p>
          {incluirPendentes && (totalPendente > 0 || totalPago > 0) && (
            <p className="text-xs opacity-80 mt-1">
              Pago {formatCurrency(totalPago)} · A receber {formatCurrency(totalPendente)}
            </p>
          )}
          <p className="text-xs opacity-70 mt-1">
            {grupos.length} {aba === 'pet' ? 'pets' : 'tutores'} · {totalLancamentos} lançamentos · ticket médio {formatCurrency(ticketMedio)}
          </p>
          {banhosTotal > 0 && (
            <p className="text-xs opacity-80 mt-1 flex items-center gap-1">
              <Scissors size={12} /> {banhosTotal} banho{banhosTotal !== 1 ? 's' : ''} no período
            </p>
          )}
        </div>
      )}

      {/* Busca por pet/tutor */}
      {!loading && grupos.length > 0 && (
        <div>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder={aba === 'pet' ? 'Buscar pet...' : 'Buscar tutor...'}
              className="w-full pl-10 pr-10 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
            />
            {filtro && (
              <button
                onClick={() => setFiltro('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Limpar busca"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {termo && (
            <p className="text-xs text-gray-400 mt-1.5 px-1">
              {gruposVisiveis.length} {gruposVisiveis.length === 1 ? 'resultado' : 'resultados'} para “{filtro.trim()}”
            </p>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nenhum lançamento neste período.</div>
      ) : gruposVisiveis.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nenhum {aba === 'pet' ? 'pet' : 'tutor'} encontrado para “{filtro.trim()}”.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gruposVisiveis.map(({ g, idx }) => {
            const key = g.id ?? '__sem__'
            const isOpen = aberto === key
            const pct = total > 0 ? (g.total / total) * 100 : 0
            const isNenhum = !g.id
            const ticketGrupo = g.lancamentos.length > 0 ? g.total / g.lancamentos.length : 0

            return (
              <div key={key} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  onClick={() => setAberto(isOpen ? null : key)}
                >
                  {/* Ranking */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isNenhum ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                      {g.nome}
                    </p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-purple rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {pct.toFixed(1)}% · {g.lancamentos.length} lançto{g.lancamentos.length !== 1 ? 's' : ''} · médio {formatCurrency(ticketGrupo)}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600">{formatCurrency(g.total)}</p>
                    {(() => {
                      const nb = g.id ? (aba === 'pet' ? banhosPet[g.id] : banhosTutor[g.id]) ?? 0 : 0
                      return nb > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1">
                          <Scissors size={10} /> {nb} banho{nb !== 1 ? 's' : ''}
                        </span>
                      ) : null
                    })()}
                    {incluirPendentes && g.totalPendente > 0 && (
                      <p className="text-[10px] text-orange-500 mt-0.5">a receber {formatCurrency(g.totalPendente)}</p>
                    )}
                    {isOpen ? <ChevronUp size={14} className="text-gray-400 ml-auto mt-0.5" /> : <ChevronDown size={14} className="text-gray-400 ml-auto mt-0.5" />}
                  </div>
                </button>

                {/* Detalhes */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {g.lancamentos.map(l => (
                      <Link
                        key={l.id}
                        href={`/financeiro/receitas/${l.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {l.descricao || CATEGORIA_RECEITA_LABELS[l.categoria]}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(l.data)}
                            {l.data_pagamento && l.data_pagamento !== l.data && (
                              <span className="text-green-600 font-medium"> · pago {formatDate(l.data_pagamento)}</span>
                            )}
                            {' · '}{AREA_LABELS[l.area]}
                            {l.status === 'pendente' && <span className="text-orange-500 font-semibold"> · a receber</span>}
                          </p>
                        </div>
                        <p className={`font-semibold text-sm flex-shrink-0 ${l.status === 'pendente' ? 'text-orange-500' : 'text-green-600'}`}>
                          +{formatCurrency(l.valor_liquido ?? l.valor)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
