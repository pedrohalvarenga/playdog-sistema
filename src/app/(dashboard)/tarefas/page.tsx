'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, Check, Clock, ListTodo, AlertTriangle, Plus, Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import {
  DIAS_SEMANA, SEMANA_LABELS, toLocalDate, hhmm, corPessoa, iniciais, tarefaAtrasada,
} from '@/lib/tarefas'
import type { Tarefa, Pessoa } from '@/types/tarefas'
import { useProfile } from '@/hooks/useProfile'

type Visao = 'hoje' | 'semana'
type Filtro = 'minhas' | 'todas'

export default function TarefasPage() {
  const { profile } = useProfile()
  const meuId = profile?.id ?? ''
  const perm = profile?.tarefas_perm ?? null
  const isCriador = perm === 'gerente' || perm === 'criador'
  const isGerente = perm === 'gerente'

  const [visao, setVisao] = useState<Visao>('hoje')
  const [filtro, setFiltro] = useState<Filtro>('minhas')
  const [data, setData] = useState(toLocalDate(new Date()))
  const [semanaBase, setSemanaBase] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d
  })
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [atrasadas, setAtrasadas] = useState<Tarefa[]>([])
  const [pessoas, setPessoas] = useState<Map<string, Pessoa>>(new Map())
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  const hoje = toLocalDate(new Date())
  const agora = new Date()
  const agoraHHMM = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`

  // Carrega pessoas (uma vez)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('pessoas').select('*').then(({ data }) => {
      const m = new Map<string, Pessoa>()
      ;(data as Pessoa[] | null)?.forEach(p => m.set(p.id, p))
      setPessoas(m)
    })
  }, [])

  const carregar = useCallback(async () => {
    if (!meuId) return
    setLoading(true)
    const supabase = createClient()

    let inicio: string, fim: string
    if (visao === 'hoje') { inicio = data; fim = data }
    else {
      const d = new Date(semanaBase); inicio = toLocalDate(d)
      const f = new Date(d); f.setDate(f.getDate() + 6); fim = toLocalDate(f)
    }

    let q = supabase.from('tarefas').select('*').gte('data', inicio).lte('data', fim)
    if (filtro === 'minhas') q = q.eq('atribuido_para', meuId)
    const { data: rows } = await q
      .order('data').order('ordem', { ascending: true, nullsFirst: false }).order('horario', { nullsFirst: true })

    // Minhas tarefas atrasadas (sempre, para o lembrete) — pendentes de dias anteriores
    const { data: atras } = await supabase
      .from('tarefas').select('*')
      .eq('atribuido_para', meuId).eq('status', 'pendente').lt('data', hoje)
      .order('data').order('horario', { nullsFirst: true })

    setTarefas((rows as Tarefa[]) ?? [])
    setAtrasadas((atras as Tarefa[]) ?? [])
    setLoading(false)
  }, [meuId, visao, filtro, data, semanaBase, hoje])

  useEffect(() => { carregar() }, [carregar])

  async function toggle(t: Tarefa) {
    const podeMarcar = t.atribuido_para === meuId || isGerente
    if (!podeMarcar) return
    setMarcando(t.id)
    const supabase = createClient()
    await supabase.rpc('tarefa_toggle', { p_id: t.id, p_concluir: t.status !== 'concluida' })
    await carregar()
    setMarcando(null)
  }

  const navData = (delta: number) => {
    const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() + delta); setData(toLocalDate(d))
  }

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaBase); d.setDate(d.getDate() + i)
    const dt = toLocalDate(d)
    return { data: dt, tarefas: tarefas.filter(t => t.data === dt) }
  })

  const doDia = tarefas.filter(t => t.data === data)
  const diaSemanaLabel = DIAS_SEMANA[new Date(data + 'T12:00:00').getDay()]

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarefas do Dia</h1>
          <p className="text-sm text-gray-400 capitalize">{formatDate(data + 'T12:00:00', "EEEE, dd 'de' MMMM")}</p>
        </div>
        {isCriador && (
          <Link href="/tarefas/montar"
            className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold active:opacity-80">
            <Plus size={18} /> Montar
          </Link>
        )}
      </div>

      {/* Lembrete de atrasadas */}
      {atrasadas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={18} />
            <p className="font-bold text-sm">
              Você tem {atrasadas.length} tarefa{atrasadas.length !== 1 ? 's' : ''} atrasada{atrasadas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <p className="text-xs text-red-600 -mt-1">Já deveriam ter sido feitas. Conclua ou fale com o responsável.</p>
          <div className="flex flex-col gap-2">
            {atrasadas.map(t => (
              <TarefaCard key={t.id} t={t} pessoas={pessoas} meuId={meuId} isGerente={isGerente}
                hoje={hoje} agoraHHMM={agoraHHMM} marcando={marcando === t.id} onToggle={toggle} mostrarData />
            ))}
          </div>
        </div>
      )}

      {/* Filtro Minhas / Todas */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        {(['minhas', 'todas'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${filtro === f ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}>
            {f === 'minhas' ? '👤 Minhas tarefas' : '👥 Todas da equipe'}
          </button>
        ))}
      </div>

      {/* Toggle Hoje / Semana */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        {(['hoje', 'semana'] as Visao[]).map(v => (
          <button key={v} onClick={() => setVisao(v)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${visao === v ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}>
            {v === 'hoje' ? 'Dia' : 'Semana'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : visao === 'hoje' ? (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => navData(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronLeft size={22} /></button>
            <p className="font-bold text-gray-800 capitalize">
              {data === hoje ? 'Hoje' : formatDate(data + 'T12:00:00', "EEE, dd/MM")} · {diaSemanaLabel}
            </p>
            <button onClick={() => navData(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronRight size={22} /></button>
          </div>

          {doDia.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ListTodo size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma tarefa neste dia</p>
              {isCriador && (
                <Link href="/tarefas/montar" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
                  + Montar tarefas do dia
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {doDia.map(t => (
                <TarefaCard key={t.id} t={t} pessoas={pessoas} meuId={meuId} isGerente={isGerente}
                  hoje={hoje} agoraHHMM={agoraHHMM} marcando={marcando === t.id} onToggle={toggle}
                  mostrarResponsavel={filtro === 'todas'} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronLeft size={22} /></button>
            <p className="font-bold text-gray-800 text-sm">
              {formatDate(diasSemana[0].data + 'T12:00:00', 'dd/MM')} – {formatDate(diasSemana[6].data + 'T12:00:00', 'dd/MM')}
            </p>
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d) }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronRight size={22} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {diasSemana.map(({ data: dt, tarefas: ts }) => {
              const isHoje = dt === hoje
              const dayDate = new Date(dt + 'T12:00:00')
              const pend = ts.filter(t => t.status === 'pendente').length
              return (
                <button key={dt} onClick={() => { setData(dt); setVisao('hoje') }}
                  className={`flex flex-col items-center py-2 rounded-2xl gap-1 transition-colors ${isHoje ? 'ring-2 ring-brand-purple' : 'hover:bg-gray-100'}`}>
                  <span className="text-[10px] text-gray-400 font-medium">{SEMANA_LABELS[dayDate.getDay()]}</span>
                  <span className={`text-sm font-bold ${isHoje ? 'text-brand-purple' : 'text-gray-700'}`}>{dayDate.getDate()}</span>
                  {ts.length > 0 ? (
                    <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${pend > 0 ? 'bg-brand-purple text-white' : 'bg-green-100 text-green-700'}`}>
                      {pend > 0 ? pend : '✓'}
                    </span>
                  ) : <span className="w-5 h-5" />}
                </button>
              )
            })}
          </div>

          {diasSemana.map(({ data: dt, tarefas: ts }) => {
            if (ts.length === 0) return null
            return (
              <div key={dt}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {formatDate(dt + 'T12:00:00', "EEE, dd/MM")} · {ts.length} tarefa{ts.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-col gap-2">
                  {ts.map(t => (
                    <TarefaCard key={t.id} t={t} pessoas={pessoas} meuId={meuId} isGerente={isGerente}
                      hoje={hoje} agoraHHMM={agoraHHMM} marcando={marcando === t.id} onToggle={toggle}
                      mostrarResponsavel={filtro === 'todas'} />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {isCriador && (
        <Link href="/tarefas/montar"
          className="py-3.5 rounded-2xl border-2 border-dashed border-purple-300 text-brand-purple font-semibold text-sm flex items-center justify-center gap-2">
          <Sparkles size={18} /> Montar / gerenciar tarefas
        </Link>
      )}
    </div>
  )
}

function TarefaCard({
  t, pessoas, meuId, isGerente, hoje, agoraHHMM, marcando, onToggle, mostrarResponsavel, mostrarData,
}: {
  t: Tarefa
  pessoas: Map<string, Pessoa>
  meuId: string
  isGerente: boolean
  hoje: string
  agoraHHMM: string
  marcando: boolean
  onToggle: (t: Tarefa) => void
  mostrarResponsavel?: boolean
  mostrarData?: boolean
}) {
  const concluida = t.status === 'concluida'
  const atrasada = tarefaAtrasada(t, hoje, agoraHHMM)
  const podeMarcar = t.atribuido_para === meuId || isGerente
  const resp = t.atribuido_para ? pessoas.get(t.atribuido_para) : null

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-3 ${atrasada ? 'border-red-200' : 'border-gray-100'}`}>
      <button
        onClick={() => onToggle(t)}
        disabled={!podeMarcar || marcando}
        aria-label={concluida ? 'Desmarcar' : 'Concluir'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
          concluida ? 'bg-green-500 border-green-500 text-white'
          : podeMarcar ? 'border-gray-300 text-transparent hover:border-green-400'
          : 'border-gray-200 text-transparent opacity-50'
        }`}>
        <Check size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${concluida ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.titulo}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {t.horario && (
            <span className={`text-xs flex items-center gap-1 ${atrasada ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              <Clock size={11} /> {hhmm(t.horario)}
            </span>
          )}
          {mostrarData && <span className="text-xs text-gray-400">{formatDate(t.data + 'T12:00:00', 'dd/MM')}</span>}
          {atrasada && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Atrasada</span>}
          {mostrarResponsavel && resp && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${corPessoa(resp.id)}`}>{iniciais(resp.nome)}</span>
              {resp.nome.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
