'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Moon, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { OCUPACAO_CORES, calcNivel, dormindoNaNoite, STATUS_HOTEL_CORES } from '@/lib/hotel'
import type { Hospedagem, EscalaPlantao, DiaCalendario, OcupacaoNivel } from '@/types/hotel'

type Visao = 'mensal' | 'semanal'

export default function AgendaPage() {
  const [visao, setVisao] = useState<Visao>('mensal')
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const [hospedagens, setHospedagens] = useState<Hospedagem[]>([])
  const [escalas, setEscalas] = useState<EscalaPlantao[]>([])
  const [capacidade, setCapacidade] = useState(10)
  const [loading, setLoading] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState<DiaCalendario | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Busca no intervalo do mês atual (com margem de 1 mês para cada lado)
    const inicio = new Date(mes.ano, mes.mes - 1, 1).toISOString()
    const fim = new Date(mes.ano, mes.mes + 2, 0, 23, 59, 59).toISOString()

    const [{ data: hosp }, { data: esc }, { data: cfg }] = await Promise.all([
      supabase
        .from('hospedagens')
        .select('*, pet:pets(nome, identificador, tutor:tutores(nome))')
        .not('status', 'in', '(cancelada)')
        .or(`checkin_previsto.lte.${fim},checkout_previsto.gte.${inicio}`)
        .order('checkin_previsto'),
      supabase
        .from('escala_plantao')
        .select('*, plantonista:plantonistas(nome)')
        .gte('data', new Date(mes.ano, mes.mes - 1, 1).toISOString().split('T')[0])
        .lte('data', new Date(mes.ano, mes.mes + 2, 0).toISOString().split('T')[0]),
      supabase
        .from('config_hotel')
        .select('valor')
        .eq('chave', 'capacidade_max')
        .single(),
    ])

    setHospedagens((hosp as Hospedagem[]) ?? [])
    setEscalas((esc as EscalaPlantao[]) ?? [])
    if (cfg) setCapacidade(Number(cfg.valor) || 10)
    setLoading(false)
  }, [mes])

  useEffect(() => { carregar() }, [carregar])

  // Constrói o array de dias do mês
  const diasDoMes = buildDiasMes(mes.ano, mes.mes, hospedagens, escalas, capacidade)

  const hoje = new Date().toISOString().split('T')[0]

  function prevMes() { setMes(m => m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ano: m.ano, mes: m.mes - 1 }) }
  function nextMes() { setMes(m => m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ano: m.ano, mes: m.mes + 1 }) }

  // Semana atual para visão semanal
  const [semanaBase, setSemanaBase] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay()) // domingo da semana atual
    return d
  })

  const diasDaSemana = buildDiasSemana(semanaBase, hospedagens, escalas, capacidade)

  const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const MESES_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
          <button
            onClick={() => setVisao('mensal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'mensal' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
          >
            Mensal
          </button>
          <button
            onClick={() => setVisao('semanal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'semanal' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
          >
            Semanal
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Livre</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Quase cheio</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Lotado</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : visao === 'mensal' ? (
        <>
          {/* Navegação mensal */}
          <div className="flex items-center justify-between">
            <button onClick={prevMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
              <ChevronLeft size={22} />
            </button>
            <p className="font-bold text-gray-900">{MESES_LABELS[mes.mes]} {mes.ano}</p>
            <button onClick={nextMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Grid cabeçalho */}
          <div className="grid grid-cols-7 gap-1">
            {SEMANA.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Grid dias */}
          <div className="grid grid-cols-7 gap-1">
            {diasDoMes.map((dia, i) => {
              if (!dia) return <div key={`empty-${i}`} />
              const isHoje = dia.data === hoje
              return (
                <button
                  key={dia.data}
                  onClick={() => setDiaSelecionado(dia)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 relative
                    ${isHoje ? 'ring-2 ring-brand-purple' : ''}
                    ${diaSelecionado?.data === dia.data ? 'bg-purple-100' : 'hover:bg-gray-50'}
                  `}
                >
                  <span className={`text-xs font-bold ${isHoje ? 'text-brand-purple' : 'text-gray-700'}`}>
                    {new Date(dia.data + 'T12:00:00').getDate()}
                  </span>
                  {dia.hospedados > 0 ? (
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${OCUPACAO_CORES[dia.nivel]}`}>
                      {dia.hospedados}
                    </span>
                  ) : (
                    <span className="w-5 h-5" />
                  )}
                  {/* Plantonista indicator */}
                  {dia.hospedados > 0 && !dia.escala?.plantonista_id && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" title="Sem plantonista" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Detalhe do dia selecionado */}
          {diaSelecionado && <DetalhesDia dia={diaSelecionado} onClose={() => setDiaSelecionado(null)} />}
        </>
      ) : (
        <>
          {/* Visão semanal — timeline */}
          <div className="flex items-center justify-between">
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
              <ChevronLeft size={22} />
            </button>
            <p className="font-bold text-gray-800 text-sm">
              {formatDate(diasDaSemana[0]?.data + 'T12:00:00', 'dd/MM')} – {formatDate(diasDaSemana[6]?.data + 'T12:00:00', 'dd/MM')}
            </p>
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Cabeçalho dias */}
          <div className="grid grid-cols-8 gap-1 text-[10px] text-gray-400 font-semibold">
            <div />
            {diasDaSemana.map(d => (
              <div key={d.data} className={`text-center ${d.data === hoje ? 'text-brand-purple font-bold' : ''}`}>
                {SEMANA[new Date(d.data + 'T12:00:00').getDay()]}<br />
                <span className="text-gray-700">{new Date(d.data + 'T12:00:00').getDate()}</span>
              </div>
            ))}
          </div>

          {/* Linhas de ocupação por noite */}
          <div className="flex flex-col gap-1">
            {diasDaSemana.map(d => (
              <div key={d.data} className="flex items-center gap-1">
                <div className="w-8 text-center">
                  <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center mx-auto ${
                    d.hospedados > 0 ? OCUPACAO_CORES[d.nivel] + ' text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{d.hospedados}</span>
                </div>
                {/* Barras de cada hospedagem */}
                <div className="flex-1 flex flex-col gap-0.5">
                  {d.hospedagens.map(h => {
                    const pet = h.pet as { nome: string } | undefined
                    return (
                      <div
                        key={h.id}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold text-white truncate ${
                          h.status === 'hospedado' ? 'bg-brand-purple' : 'bg-blue-400'
                        }`}
                      >
                        {pet?.nome}
                      </div>
                    )
                  })}
                  {d.escala?.plantonista && (
                    <div className="flex items-center gap-1 text-[10px] text-indigo-500">
                      <Moon size={10} /> {(d.escala.plantonista as { nome?: string })?.nome}
                    </div>
                  )}
                  {d.hospedados > 0 && !d.escala?.plantonista_id && (
                    <div className="flex items-center gap-1 text-[10px] text-red-400">
                      <AlertTriangle size={10} /> Sem plantonista
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DetalhesDia({ dia, onClose }: { dia: DiaCalendario; onClose: () => void }) {
  const escala = dia.escala
  const plantonista = escala?.plantonista as { nome?: string } | undefined

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">{formatDate(dia.data + 'T12:00:00', "dd 'de' MMMM")}</p>
        <button onClick={onClose} className="text-gray-400 text-sm">✕</button>
      </div>

      {/* Plantonista */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
        dia.hospedados > 0 && !plantonista ? 'bg-red-50' : 'bg-gray-50'
      }`}>
        <Moon size={16} className={dia.hospedados > 0 && !plantonista ? 'text-red-400' : 'text-indigo-400'} />
        <span className="text-sm text-gray-700">
          {plantonista?.nome ?? (dia.hospedados > 0 ? '⚠️ Ninguém escalado!' : 'Sem plantonista')}
        </span>
      </div>

      {dia.entradas.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Entradas</p>
          {dia.entradas.map(h => {
            const p = h.pet as { nome: string } | undefined
            return (
              <div key={h.id} className="text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                🐾 {p?.nome} — entrada {new Date(h.checkin_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )
          })}
        </div>
      )}

      {dia.hospedagens.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Hospedados esta noite ({dia.hospedados}/{dia.capacidade})
          </p>
          {dia.hospedagens.map(h => {
            const p = h.pet as { nome: string } | undefined
            return (
              <div key={h.id} className="text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                🐾 {p?.nome}
              </div>
            )
          })}
        </div>
      )}

      {dia.saidas.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Saídas</p>
          {dia.saidas.map(h => {
            const p = h.pet as { nome: string } | undefined
            return (
              <div key={h.id} className="text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                🐾 {p?.nome} — saída {new Date(h.checkout_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )
          })}
        </div>
      )}

      {dia.hospedados === 0 && dia.entradas.length === 0 && dia.saidas.length === 0 && (
        <p className="text-sm text-gray-400 text-center">Nenhuma hospedagem neste dia</p>
      )}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────

function buildDiasMes(
  ano: number,
  mesIdx: number,
  hospedagens: Hospedagem[],
  escalas: EscalaPlantao[],
  capacidade: number
): (DiaCalendario | null)[] {
  const primeiroDia = new Date(ano, mesIdx, 1)
  const ultimoDia = new Date(ano, mesIdx + 1, 0)
  const inicioPad = primeiroDia.getDay() // dia da semana do dia 1

  const dias: (DiaCalendario | null)[] = Array(inicioPad).fill(null)

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    const data = `${ano}-${String(mesIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dias.push(buildDia(data, hospedagens, escalas, capacidade))
  }

  return dias
}

function buildDiasSemana(
  base: Date,
  hospedagens: Hospedagem[],
  escalas: EscalaPlantao[],
  capacidade: number
): DiaCalendario[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    const data = d.toISOString().split('T')[0]
    return buildDia(data, hospedagens, escalas, capacidade)
  })
}

function buildDia(
  data: string,
  hospedagens: Hospedagem[],
  escalas: EscalaPlantao[],
  capacidade: number
): DiaCalendario {
  const hospNaNoite = hospedagens.filter(h =>
    dormindoNaNoite(h.checkin_previsto, h.checkout_previsto, data)
  )
  const entradas = hospedagens.filter(h =>
    new Date(h.checkin_previsto).toISOString().split('T')[0] === data
  )
  const saidas = hospedagens.filter(h =>
    new Date(h.checkout_previsto).toISOString().split('T')[0] === data
  )
  const escala = escalas.find(e => e.data === data)
  const nivel = calcNivel(hospNaNoite.length, capacidade)

  return { data, hospedados: hospNaNoite.length, capacidade, nivel, hospedagens: hospNaNoite, entradas, saidas, escala }
}
