'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Car, ChevronLeft, ChevronRight, Check, X, Scissors } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import {
  STATUS_BT_LABELS, STATUS_BT_CORES,
  proximoStatusBT, formatHora, formatCurrencyBT,
} from '@/lib/banho_tosa'
import type { AgendamentoBanhoTosa, StatusAgendamento } from '@/types/banho_tosa'
import { useProfile } from '@/hooks/useProfile'

type Visao = 'hoje' | 'semana'

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function BanhoTosaPage() {
  const { profile } = useProfile()
  const [visao, setVisao] = useState<Visao>('hoje')
  const [dataSelecionada, setDataSelecionada] = useState(toLocalDate(new Date()))
  const [semanaBase, setSemanaBase] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    return d
  })
  const [agendamentos, setAgendamentos] = useState<AgendamentoBanhoTosa[]>([])
  const [loading, setLoading] = useState(true)
  const [avancando, setAvancando] = useState<string | null>(null)

  // Estado do modal de pagamento
  const [modalPag, setModalPag] = useState<AgendamentoBanhoTosa | null>(null)
  const [valorServico, setValorServico] = useState('')
  const [valorTaxi, setValorTaxi] = useState('')
  const [formaPag, setFormaPag] = useState('pix')
  const [statusPag, setStatusPag] = useState<'pago' | 'pendente'>('pago')
  const [salvandoPag, setSalvandoPag] = useState(false)

  // Estado do modal de cancelamento
  const [modalCancel, setModalCancel] = useState<AgendamentoBanhoTosa | null>(null)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [cancelando, setCancelando] = useState(false)

  const hoje = toLocalDate(new Date())
  const podePagar = profile?.role === 'admin' || profile?.role === 'recepcao'
  const podeNovo  = podePagar

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let inicio: string, fim: string
    if (visao === 'hoje') {
      inicio = dataSelecionada
      fim    = dataSelecionada
    } else {
      const d = new Date(semanaBase)
      inicio = toLocalDate(d)
      const f = new Date(d)
      f.setDate(f.getDate() + 6)
      fim = toLocalDate(f)
    }

    const { data } = await supabase
      .from('agendamentos_banho_tosa')
      .select('*, pet:pets(id, nome, identificador, foto_url, porte, tutor_id, tutor:tutores(nome, telefone, whatsapp, endereco))')
      .gte('data', inicio)
      .lte('data', fim)
      .not('status', 'eq', 'cancelado')
      .order('hora_chegada')

    setAgendamentos((data as AgendamentoBanhoTosa[]) ?? [])
    setLoading(false)
  }, [visao, dataSelecionada, semanaBase])

  useEffect(() => { carregar() }, [carregar])

  async function avancar(id: string, novoStatus: StatusAgendamento) {
    if (novoStatus === 'entregue') return // handled by modal
    setAvancando(id)
    const supabase = createClient()
    const extra: Record<string, unknown> = {}
    if (novoStatus === 'em_atendimento') extra.hora_chegada_real = new Date().toISOString()
    await supabase.from('agendamentos_banho_tosa').update({ status: novoStatus, ...extra }).eq('id', id)
    await carregar()
    setAvancando(null)
  }

  function abrirModalPag(ag: AgendamentoBanhoTosa) {
    setModalPag(ag)
    setValorServico(ag.valor_servico != null ? ag.valor_servico.toFixed(2).replace('.', ',') : '')
    setValorTaxi(ag.valor_taxi != null ? ag.valor_taxi.toFixed(2).replace('.', ',') : '')
    setFormaPag('pix')
    setStatusPag('pago')
  }

  async function confirmarEntrega() {
    if (!modalPag) return
    setSalvandoPag(true)
    const supabase = createClient()
    const pet = modalPag.pet!
    const vServico = parseFloat(valorServico.replace(',', '.')) || 0
    const vTaxi    = parseFloat(valorTaxi.replace(',', '.')) || 0
    const updates: Record<string, unknown> = {
      status: 'entregue',
      hora_saida_real: new Date().toISOString(),
    }

    if (vServico > 0) {
      const { data: r1 } = await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: vServico,
        area: 'banho_tosa',
        categoria: 'banho_tosa',
        forma_pagamento: formaPag,
        status: statusPag,
        descricao: `Banho & Tosa — ${pet.nome}${pet.identificador ? ` (${pet.identificador})` : ''}: ${modalPag.descricao_servico}`,
        tutor_id: pet.tutor_id,
        pet_id: pet.id,
      }).select('id').single()
      if (r1) updates.receita_servico_id = r1.id
    }

    if (modalPag.taxi_dog && vTaxi > 0) {
      const { data: r2 } = await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: vTaxi,
        area: 'transporte',
        categoria: 'transporte',
        forma_pagamento: formaPag,
        status: statusPag,
        descricao: `Taxi Dog — ${pet.nome}${pet.identificador ? ` (${pet.identificador})` : ''} (${modalPag.taxi_tipo})`,
        tutor_id: pet.tutor_id,
        pet_id: pet.id,
      }).select('id').single()
      if (r2) updates.receita_taxi_id = r2.id
    }

    await supabase.from('agendamentos_banho_tosa').update(updates).eq('id', modalPag.id)
    setSalvandoPag(false)
    setModalPag(null)
    await carregar()
  }

  async function confirmarCancelamento() {
    if (!modalCancel || !motivoCancel.trim()) return
    setCancelando(true)
    const supabase = createClient()
    await supabase.from('agendamentos_banho_tosa')
      .update({ status: 'cancelado', motivo_cancelamento: motivoCancel.trim() })
      .eq('id', modalCancel.id)
    // Cancela transportes vinculados
    await supabase.from('transportes')
      .update({ status: 'cancelado' })
      .eq('origem_id', modalCancel.id)
    setCancelando(false)
    setModalCancel(null)
    setMotivoCancel('')
    await carregar()
  }

  // Build dias da semana para visão semanal
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaBase)
    d.setDate(d.getDate() + i)
    const data = toLocalDate(d)
    const ags = agendamentos.filter(a => a.data === data)
    return { data, ags }
  })
  const SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const agendamentosHoje = agendamentos.filter(a => a.data === dataSelecionada)

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banho &amp; Tosa</h1>
          <p className="text-sm text-gray-400">{formatDate(dataSelecionada + 'T12:00:00', "dd 'de' MMMM, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/banho-tosa/agendamentos" className="text-xs text-brand-purple font-semibold px-3 py-1.5 rounded-xl border border-purple-200">
            Todos
          </Link>
          {podeNovo && (
            <Link
              href="/banho-tosa/agendamentos/novo"
              className="flex items-center gap-1.5 bg-brand-teal text-white px-4 py-2 rounded-2xl text-sm font-semibold active:opacity-80"
            >
              <Plus size={18} />
              Novo
            </Link>
          )}
        </div>
      </div>

      {/* Toggle visão */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        <button
          onClick={() => setVisao('hoje')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'hoje' ? 'bg-white shadow text-brand-teal' : 'text-gray-500'}`}
        >
          Hoje
        </button>
        <button
          onClick={() => setVisao('semana')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'semana' ? 'bg-white shadow text-brand-teal' : 'text-gray-500'}`}
        >
          Semana
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
        </div>
      ) : visao === 'hoje' ? (
        <>
          {/* Navegação dia */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const d = new Date(dataSelecionada + 'T12:00:00')
                d.setDate(d.getDate() - 1)
                setDataSelecionada(toLocalDate(d))
              }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={22} />
            </button>
            <p className="font-bold text-gray-800">
              {dataSelecionada === hoje ? 'Hoje' : formatDate(dataSelecionada + 'T12:00:00', "EEE, dd/MM")}
            </p>
            <button
              onClick={() => {
                const d = new Date(dataSelecionada + 'T12:00:00')
                d.setDate(d.getDate() + 1)
                setDataSelecionada(toLocalDate(d))
              }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Contador */}
          {agendamentosHoje.length > 0 && (
            <p className="text-xs text-gray-400 font-medium">
              {agendamentosHoje.length} atendimento{agendamentosHoje.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Lista */}
          {agendamentosHoje.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Scissors size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum atendimento neste dia</p>
              {podeNovo && (
                <Link href="/banho-tosa/agendamentos/novo" className="text-brand-teal text-sm font-semibold mt-2 inline-block">
                  + Novo agendamento
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {agendamentosHoje.map(ag => (
                <AgendamentoCard
                  key={ag.id}
                  ag={ag}
                  avancando={avancando === ag.id}
                  podePagar={podePagar}
                  onAvancar={avancar}
                  onEntregue={abrirModalPag}
                  onCancelar={setModalCancel}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Navegação semana */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={22} />
            </button>
            <p className="font-bold text-gray-800 text-sm">
              {formatDate(diasSemana[0].data + 'T12:00:00', 'dd/MM')} – {formatDate(diasSemana[6].data + 'T12:00:00', 'dd/MM')}
            </p>
            <button
              onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Grid semanal */}
          <div className="grid grid-cols-7 gap-1">
            {diasSemana.map(({ data, ags }) => {
              const isHoje = data === hoje
              const dayDate = new Date(data + 'T12:00:00')
              return (
                <button
                  key={data}
                  onClick={() => { setDataSelecionada(data); setVisao('hoje') }}
                  className={`flex flex-col items-center py-2 rounded-2xl gap-1 transition-colors
                    ${isHoje ? 'ring-2 ring-brand-teal' : 'hover:bg-gray-100'}
                  `}
                >
                  <span className="text-[10px] text-gray-400 font-medium">{SEMANA_LABELS[dayDate.getDay()]}</span>
                  <span className={`text-sm font-bold ${isHoje ? 'text-brand-teal' : 'text-gray-700'}`}>
                    {dayDate.getDate()}
                  </span>
                  {ags.length > 0 ? (
                    <span className="w-5 h-5 rounded-full bg-brand-teal text-white text-[9px] font-bold flex items-center justify-center">
                      {ags.length}
                    </span>
                  ) : (
                    <span className="w-5 h-5" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Lista do dia selecionado na semana */}
          {diasSemana.map(({ data, ags }) => {
            if (ags.length === 0) return null
            return (
              <div key={data}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {formatDate(data + 'T12:00:00', "EEE, dd/MM")} · {ags.length} atendimento{ags.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-col gap-2">
                  {ags.map(ag => (
                    <AgendamentoCard
                      key={ag.id}
                      ag={ag}
                      avancando={avancando === ag.id}
                      podePagar={podePagar}
                      onAvancar={avancar}
                      onEntregue={abrirModalPag}
                      onCancelar={setModalCancel}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Modal Pagamento */}
      {modalPag && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Registrar entrega</h2>
            <p className="text-sm text-gray-500">{modalPag.pet?.nome} — {modalPag.descricao_servico}</p>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Valor do serviço (R$)
              </label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={valorServico}
                onChange={e => setValorServico(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm"
              />
            </div>

            {modalPag.taxi_dog && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Valor do Taxi Dog (R$)
                </label>
                <input
                  type="number" inputMode="decimal" min="0" step="0.01"
                  value={valorTaxi}
                  onChange={e => setValorTaxi(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Será registrado separadamente como receita de transporte</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Forma de pagamento
              </label>
              <select
                value={formaPag}
                onChange={e => setFormaPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Status do pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStatusPag('pago')}
                  className={`py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
                    statusPag === 'pago'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Pago
                </button>
                <button
                  onClick={() => setStatusPag('pendente')}
                  className={`py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
                    statusPag === 'pendente'
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Pendente
                </button>
              </div>
            </div>

            <div className="bg-teal-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Resumo</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Serviço</span>
                <span className="font-bold text-gray-900">{formatCurrencyBT(parseFloat(valorServico.replace(',', '.')) || 0)}</span>
              </div>
              {modalPag.taxi_dog && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Taxi Dog</span>
                  <span className="font-bold text-gray-900">{formatCurrencyBT(parseFloat(valorTaxi.replace(',', '.')) || 0)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModalPag(null)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEntrega}
                disabled={salvandoPag}
                className="py-3 rounded-2xl bg-green-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {salvandoPag ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Check size={18} /> Confirmar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelamento */}
      {modalCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Cancelar agendamento</h2>
            <p className="text-sm text-gray-500">{modalCancel.pet?.nome} — {formatDate(modalCancel.data + 'T12:00:00', 'dd/MM')}</p>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Motivo *</label>
              <textarea
                rows={3}
                value={motivoCancel}
                onChange={e => setMotivoCancel(e.target.value)}
                placeholder="Explique o motivo do cancelamento..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-red-400 outline-none text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setModalCancel(null); setMotivoCancel('') }}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={confirmarCancelamento}
                disabled={!motivoCancel.trim() || cancelando}
                className="py-3 rounded-2xl bg-red-500 text-white font-bold disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AgendamentoCard({
  ag, avancando, podePagar, onAvancar, onEntregue, onCancelar,
}: {
  ag: AgendamentoBanhoTosa
  avancando: boolean
  podePagar: boolean
  onAvancar: (id: string, status: StatusAgendamento) => void
  onEntregue: (ag: AgendamentoBanhoTosa) => void
  onCancelar: (ag: AgendamentoBanhoTosa) => void
}) {
  const pet = ag.pet!
  const proximo = proximoStatusBT(ag.status)
  const isFinal = ag.status === 'entregue' || ag.status === 'cancelado'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <Link href={`/banho-tosa/agendamentos/${ag.id}`} className="block">
        <div className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {pet.foto_url ? (
              <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">🐾</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-gray-900">
                {pet.nome}
                {pet.identificador && (
                  <span className="text-gray-400 font-normal text-sm ml-1">({pet.identificador})</span>
                )}
              </p>
              {ag.taxi_dog && <Car size={13} className="text-brand-orange flex-shrink-0" />}
            </div>
            <p className="text-sm text-gray-500 truncate">{ag.descricao_servico}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BT_CORES[ag.status]}`}>
                {STATUS_BT_LABELS[ag.status]}
              </span>
              <span className="text-xs text-gray-400">
                {formatHora(ag.hora_chegada)}
                {ag.hora_saida_prevista && ` → ${formatHora(ag.hora_saida_prevista)}`}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {!isFinal && proximo && (
        <div className="px-4 pb-3 flex gap-2">
          {proximo === 'entregue' ? (
            podePagar && (
              <button
                onClick={() => onEntregue(ag)}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                <Check size={15} /> Registrar entrega
              </button>
            )
          ) : (
            <button
              onClick={() => onAvancar(ag.id, proximo)}
              disabled={avancando}
              className="flex-1 py-2.5 rounded-xl bg-brand-teal/10 text-brand-teal font-semibold text-sm disabled:opacity-50"
            >
              {avancando ? '...' : `→ ${STATUS_BT_LABELS[proximo]}`}
            </button>
          )}
          {podePagar && (
            <button
              onClick={() => onCancelar(ag)}
              className="px-3 py-2.5 rounded-xl border border-red-200 text-red-400 text-sm"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
