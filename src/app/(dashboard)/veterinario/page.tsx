'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronLeft, ChevronRight, Check, X, Stethoscope, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { STATUS_VET_LABELS, STATUS_VET_CORES, formatHoraVet } from '@/lib/veterinario'
import type { AgendamentoVeterinario } from '@/types/veterinario'
import { useProfile } from '@/hooks/useProfile'

type Visao = 'hoje' | 'semana'

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function VeterinarioPage() {
  const { profile } = useProfile()
  const [visao, setVisao] = useState<Visao>('hoje')
  const [dataSelecionada, setDataSelecionada] = useState(toLocalDate(new Date()))
  const [semanaBase, setSemanaBase] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    return d
  })
  const [agendamentos, setAgendamentos] = useState<AgendamentoVeterinario[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  // Modal de cancelamento
  const [modalCancel, setModalCancel] = useState<AgendamentoVeterinario | null>(null)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [cancelando, setCancelando] = useState(false)

  const hoje = toLocalDate(new Date())
  const podeEditar = profile?.role === 'admin' || profile?.role === 'recepcao'

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
      .from('agendamentos_veterinario')
      .select('*, pet:pets(id, nome, identificador, foto_url, tutor_id, tutor:tutores(nome, telefone, whatsapp))')
      .gte('data', inicio)
      .lte('data', fim)
      .not('status', 'eq', 'cancelado')
      .order('hora', { nullsFirst: true })

    setAgendamentos((data as AgendamentoVeterinario[]) ?? [])
    setLoading(false)
  }, [visao, dataSelecionada, semanaBase])

  useEffect(() => { carregar() }, [carregar])

  async function marcarRealizado(ag: AgendamentoVeterinario, desfazer = false) {
    setAtualizando(ag.id)
    const supabase = createClient()
    await supabase.from('agendamentos_veterinario')
      .update({ status: desfazer ? 'agendado' : 'realizado' })
      .eq('id', ag.id)
    await carregar()
    setAtualizando(null)
  }

  async function confirmarCancelamento() {
    if (!modalCancel || !motivoCancel.trim()) return
    setCancelando(true)
    const supabase = createClient()
    await supabase.from('agendamentos_veterinario')
      .update({ status: 'cancelado', motivo_cancelamento: motivoCancel.trim() })
      .eq('id', modalCancel.id)
    setCancelando(false)
    setModalCancel(null)
    setMotivoCancel('')
    await carregar()
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Veterinário</h1>
          <p className="text-sm text-gray-400">{formatDate(dataSelecionada + 'T12:00:00', "dd 'de' MMMM, yyyy")}</p>
        </div>
        {podeEditar && (
          <Link
            href="/veterinario/agendamentos/novo"
            className="flex items-center gap-1.5 bg-rose-500 text-white px-4 py-2 rounded-2xl text-sm font-semibold active:opacity-80"
          >
            <Plus size={18} />
            Novo
          </Link>
        )}
      </div>

      {/* Toggle visão */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        <button
          onClick={() => setVisao('hoje')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'hoje' ? 'bg-white shadow text-rose-500' : 'text-gray-500'}`}
        >
          Hoje
        </button>
        <button
          onClick={() => setVisao('semana')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === 'semana' ? 'bg-white shadow text-rose-500' : 'text-gray-500'}`}
        >
          Semana
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
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

          {agendamentosHoje.length > 0 && (
            <p className="text-xs text-gray-400 font-medium">
              {agendamentosHoje.length} atendimento{agendamentosHoje.length !== 1 ? 's' : ''}
            </p>
          )}

          {agendamentosHoje.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Stethoscope size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum atendimento neste dia</p>
              {podeEditar && (
                <Link href="/veterinario/agendamentos/novo" className="text-rose-500 text-sm font-semibold mt-2 inline-block">
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
                  atualizando={atualizando === ag.id}
                  podeEditar={podeEditar}
                  onRealizado={marcarRealizado}
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
                    ${isHoje ? 'ring-2 ring-rose-400' : 'hover:bg-gray-100'}
                  `}
                >
                  <span className="text-[10px] text-gray-400 font-medium">{SEMANA_LABELS[dayDate.getDay()]}</span>
                  <span className={`text-sm font-bold ${isHoje ? 'text-rose-500' : 'text-gray-700'}`}>
                    {dayDate.getDate()}
                  </span>
                  {ags.length > 0 ? (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {ags.length}
                    </span>
                  ) : (
                    <span className="w-5 h-5" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Lista por dia da semana */}
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
                      atualizando={atualizando === ag.id}
                      podeEditar={podeEditar}
                      onRealizado={marcarRealizado}
                      onCancelar={setModalCancel}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
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
  ag, atualizando, podeEditar, onRealizado, onCancelar,
}: {
  ag: AgendamentoVeterinario
  atualizando: boolean
  podeEditar: boolean
  onRealizado: (ag: AgendamentoVeterinario, desfazer?: boolean) => void
  onCancelar: (ag: AgendamentoVeterinario) => void
}) {
  const pet = ag.pet
  const realizado = ag.status === 'realizado'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {pet?.foto_url ? (
            <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">🐾</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">
            {pet?.nome ?? 'Pet'}
            {pet?.identificador && (
              <span className="text-gray-400 font-normal text-sm ml-1">({pet.identificador})</span>
            )}
          </p>
          <p className="text-sm text-gray-500 truncate">{ag.motivo}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_VET_CORES[ag.status]}`}>
              {STATUS_VET_LABELS[ag.status]}
            </span>
            {ag.hora && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={11} /> {formatHoraVet(ag.hora)}
              </span>
            )}
          </div>
          {ag.observacoes && (
            <p className="text-xs text-gray-400 mt-1">{ag.observacoes}</p>
          )}
        </div>
      </div>

      {podeEditar && (
        <div className="px-4 pb-3 flex gap-2">
          {realizado ? (
            <button
              onClick={() => onRealizado(ag, true)}
              disabled={atualizando}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-semibold text-sm disabled:opacity-50"
            >
              {atualizando ? '...' : 'Desfazer'}
            </button>
          ) : (
            <button
              onClick={() => onRealizado(ag)}
              disabled={atualizando}
              className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={15} /> {atualizando ? '...' : 'Marcar realizado'}
            </button>
          )}
          <button
            onClick={() => onCancelar(ag)}
            className="px-3 py-2.5 rounded-xl border border-red-200 text-red-400 text-sm"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
