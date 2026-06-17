'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Search, X, Plus, Clock,
  Sparkles, ChevronUp, ChevronDown, Car, Check, GripVertical,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { hojeLocal } from '@/lib/datas'
import { trechoDaRota } from '@/lib/transporte'
import type { Transporte, TipoRota, TrechoTransporte } from '@/types/transporte'
import { useProfile } from '@/hooks/useProfile'

// Quantos dias para trás olhamos para aprender o padrão (≈ 10 semanas)
const JANELA_DIAS = 70

type BuscaPet = {
  id: string
  nome: string
  identificador: string | null
  foto_url: string | null
  tutor_id: string
  tutor: { endereco: string | null; telefone: string | null } | null
}

type Sugestao = {
  pet_id: string
  nome: string
  identificador: string | null
  foto_url: string | null
  tutor_id: string
  vezes: number
  total: number
  horario: string | null // habitual, HH:MM
}

function hhmm(horario: string | null | undefined): string {
  if (!horario) return ''
  return horario.slice(0, 5)
}

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export default function ListaRapidaPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const hoje = hojeLocal()
  const [data, setData] = useState(hoje)
  const [tab, setTab] = useState<TipoRota>(() => new Date().getHours() < 12 ? 'coleta' : 'entrega')
  const [itens, setItens] = useState<Transporte[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [loading, setLoading] = useState(true)
  const [aprendendo, setAprendendo] = useState(false)

  // Campo de digitação rápida
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<BuscaPet[]>([])
  const [adicionando, setAdicionando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Arrastar para reordenar
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragIdx = useRef<number | null>(null)
  const itensRef = useRef<Transporte[]>([])
  useEffect(() => { itensRef.current = itens }, [itens])

  const perfilCarregado = profile != null
  const podeEditar = profile?.role === 'admin' || profile?.role === 'recepcao'
  const trecho: TrechoTransporte = trechoDaRota(tab)
  const idsNaLista = new Set(itens.map(t => t.pet_id))

  // Motorista não preenche lista — volta para a tela de rotas
  useEffect(() => {
    if (perfilCarregado && !podeEditar) router.replace('/transportes')
  }, [perfilCarregado, podeEditar, router])

  // ── Carrega a lista atual do dia/trecho ───────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('transportes')
      .select('*, pet:pets_rota(id, nome, identificador, foto_url, tutor_id)')
      .eq('data', data)
      .eq('tipo', trecho)
      .not('status', 'eq', 'cancelado')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('horario')
    setItens((rows as Transporte[]) ?? [])
    setLoading(false)
  }, [data, trecho])

  useEffect(() => { carregar() }, [carregar])

  // ── Aprende o padrão do dia da semana (sugestões) ─────────────
  const aprenderPadrao = useCallback(async () => {
    setAprendendo(true)
    const supabase = createClient()
    const alvo = new Date(data + 'T12:00:00')
    const diaSemana = alvo.getDay()
    const inicio = new Date(alvo)
    inicio.setDate(inicio.getDate() - JANELA_DIAS)

    const { data: hist } = await supabase
      .from('transportes')
      .select('pet_id, data, horario, pet:pets_rota(id, nome, identificador, foto_url, tutor_id)')
      .eq('tipo', trecho)
      .not('status', 'eq', 'cancelado')
      .gte('data', toLocalDate(inicio))
      .lt('data', data)

    const rows = (hist ?? []) as unknown as Array<{
      pet_id: string; data: string; horario: string | null
      pet: { id: string; nome: string; identificador: string | null; foto_url: string | null; tutor_id: string } | null
    }>

    // Só os registros que caem no mesmo dia da semana do alvo
    const noDia = rows.filter(r => new Date(r.data + 'T12:00:00').getDay() === diaSemana)
    const datasDistintas = new Set(noDia.map(r => r.data))
    const total = datasDistintas.size

    type Acc = { datas: Set<string>; horarios: string[]; pet: NonNullable<typeof rows[number]['pet']> }
    const porPet = new Map<string, Acc>()
    for (const r of noDia) {
      if (!r.pet) continue
      const a = porPet.get(r.pet_id) ?? { datas: new Set<string>(), horarios: [], pet: r.pet }
      a.datas.add(r.data)
      if (r.horario) a.horarios.push(hhmm(r.horario))
      porPet.set(r.pet_id, a)
    }

    const lista: Sugestao[] = []
    for (const [pet_id, a] of porPet) {
      // horário habitual = mais frequente
      let horario: string | null = null
      if (a.horarios.length) {
        const cont = new Map<string, number>()
        for (const h of a.horarios) cont.set(h, (cont.get(h) ?? 0) + 1)
        horario = [...cont.entries()].sort((x, y) => y[1] - x[1])[0][0]
      }
      lista.push({
        pet_id, nome: a.pet.nome, identificador: a.pet.identificador,
        foto_url: a.pet.foto_url, tutor_id: a.pet.tutor_id,
        vezes: a.datas.size, total, horario,
      })
    }
    lista.sort((x, y) => y.vezes - x.vezes || x.nome.localeCompare(y.nome))
    setSugestoes(lista)
    setAprendendo(false)
  }, [data, trecho])

  useEffect(() => { aprenderPadrao() }, [aprenderPadrao])

  // ── Busca de pets para o campo de digitação rápida ────────────
  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const termo = busca.toLowerCase()
      const { data: pets } = await supabase
        .from('pets')
        .select('id, nome, identificador, foto_url, tutor_id, tutor:tutores(endereco, telefone)')
        .eq('ativo', true)
        .or(`nome.ilike.%${termo}%,identificador.ilike.%${termo}%`)
        .limit(8)
      setResultados((pets as unknown as BuscaPet[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  // ── Adiciona um pet à lista ───────────────────────────────────
  async function adicionar(opts: {
    pet_id: string; tutor_id: string | null
    endereco?: string | null; telefone?: string | null; horario?: string | null
  }) {
    if (idsNaLista.has(opts.pet_id)) return
    setAdicionando(true)
    const supabase = createClient()

    let endereco = opts.endereco ?? null
    let telefone = opts.telefone ?? null
    // Quando veio da sugestão só temos o tutor_id — buscamos o endereço
    if (endereco == null && opts.tutor_id) {
      const { data: tut } = await supabase
        .from('tutores_rota')
        .select('endereco, telefone')
        .eq('id', opts.tutor_id)
        .maybeSingle()
      endereco = (tut as { endereco: string | null } | null)?.endereco ?? null
      telefone = telefone ?? (tut as { telefone: string | null } | null)?.telefone ?? null
    }

    // Padrão: quem vem também volta — cria coleta (buscar) E entrega (levar).
    // Se o cão vier e não voltar (ou o contrário), apaga-se o trecho à mão.
    const { data: doDia } = await supabase
      .from('transportes')
      .select('id, tipo, ordem, pet_id')
      .eq('data', data)
      .not('status', 'eq', 'cancelado')
    const rows = (doDia as { tipo: TrechoTransporte; ordem: number | null; pet_id: string }[]) ?? []
    const maxOrdem = (tp: TrechoTransporte) => {
      const os = rows.filter(r => r.tipo === tp).map(r => r.ordem ?? 0)
      return os.length ? Math.max(...os) : 0
    }
    const jaTem = (tp: TrechoTransporte) => rows.some(r => r.pet_id === opts.pet_id && r.tipo === tp)

    const base = {
      origem: 'creche',
      origem_id: null,
      pet_id: opts.pet_id,
      data,
      endereco: endereco?.trim() || 'A definir',
      telefone: telefone || null,
      meio: 'playdog',
      status: 'pendente',
    }
    const inserts = (['buscar', 'levar'] as TrechoTransporte[])
      .filter(tp => !jaTem(tp))
      .map(tp => ({
        ...base,
        tipo: tp,
        // o horário digitado/sugerido vale para o trecho aberto; o espelho começa sem horário
        horario: tp === trecho ? (opts.horario || null) : null,
        ordem: maxOrdem(tp) + 1,
      }))
    if (inserts.length) await supabase.from('transportes').insert(inserts)

    setBusca('')
    setResultados([])
    setAdicionando(false)
    inputRef.current?.focus()
    await carregar()
  }

  // ── Edita o horário de chegada (opcional) ─────────────────────
  async function salvarHorario(t: Transporte, valor: string) {
    setItens(prev => prev.map(x => x.id === t.id ? { ...x, horario: valor || null } : x))
    const supabase = createClient()
    await supabase.from('transportes').update({ horario: valor || null }).eq('id', t.id)
  }

  // ── Grava a ordem atual no banco ──────────────────────────────
  async function persistirOrdem(arr: Transporte[]) {
    const supabase = createClient()
    await Promise.all(arr.map((t, i) =>
      supabase.from('transportes').update({ ordem: i + 1 }).eq('id', t.id)
    ))
  }

  // ── Reordena pelas setas (sobe/desce) ─────────────────────────
  async function mover(idx: number, delta: number) {
    const destino = idx + delta
    if (destino < 0 || destino >= itens.length) return
    const novo = [...itens]
    const [item] = novo.splice(idx, 1)
    novo.splice(destino, 0, item)
    setItens(novo)
    await persistirOrdem(novo)
  }

  // ── Reordena arrastando (toque ou mouse) ──────────────────────
  // Usa listeners globais no window: setPointerCapture + eventos sintéticos
  // do React não são confiáveis durante o re-render da lista.
  const onPointerMoveWin = useCallback((e: PointerEvent) => {
    if (dragIdx.current == null) return
    e.preventDefault()
    const y = e.clientY
    const n = itensRef.current.length
    let alvo = n - 1
    for (let i = 0; i < n; i++) {
      const el = rowRefs.current[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (y < r.top + r.height / 2) { alvo = i; break }
    }
    if (alvo !== dragIdx.current) {
      const de = dragIdx.current
      setItens(prev => {
        const arr = [...prev]
        const [it] = arr.splice(de, 1)
        arr.splice(alvo, 0, it)
        return arr
      })
      dragIdx.current = alvo
    }
  }, [])

  const onPointerUpWin = useCallback(async () => {
    window.removeEventListener('pointermove', onPointerMoveWin)
    window.removeEventListener('pointerup', onPointerUpWin)
    if (dragIdx.current == null) return
    dragIdx.current = null
    setArrastandoId(null)
    await persistirOrdem(itensRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMoveWin])

  function iniciarArraste(e: React.PointerEvent, idx: number) {
    e.preventDefault()
    dragIdx.current = idx
    setArrastandoId(itens[idx].id)
    window.addEventListener('pointermove', onPointerMoveWin, { passive: false })
    window.addEventListener('pointerup', onPointerUpWin)
  }

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMoveWin)
    window.removeEventListener('pointerup', onPointerUpWin)
  }, [onPointerMoveWin, onPointerUpWin])

  async function remover(t: Transporte) {
    setItens(prev => prev.filter(x => x.id !== t.id))
    const supabase = createClient()
    await supabase.from('transportes').delete().eq('id', t.id)
  }

  async function adicionarTodasSugestoes() {
    const novas = sugestoes.filter(s => !idsNaLista.has(s.pet_id))
    for (const s of novas) {
      await adicionar({ pet_id: s.pet_id, tutor_id: s.tutor_id, horario: s.horario })
    }
  }

  const navData = (delta: number) => {
    const d = new Date(data + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setData(toLocalDate(d))
  }

  const sugestoesNovas = sugestoes.filter(s => !idsNaLista.has(s.pet_id))
  const diaSemanaLabel = DIAS_SEMANA[new Date(data + 'T12:00:00').getDay()]

  if (!perfilCarregado || (perfilCarregado && !podeEditar)) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transportes" className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista rápida</h1>
          <p className="text-sm text-gray-400">Quem adicionar entra na coleta e na entrega</p>
        </div>
      </div>

      {/* Navegação dia */}
      <div className="flex items-center justify-between">
        <button onClick={() => navData(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-800 capitalize">
          {data === hoje ? 'Hoje' : formatDate(data + 'T12:00:00', "EEE, dd 'de' MMMM")} · {diaSemanaLabel}
        </p>
        <button onClick={() => navData(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Tabs Coleta / Entrega */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        {(['coleta', 'entrega'] as TipoRota[]).map(tipo => (
          <button key={tipo} onClick={() => setTab(tipo)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === tipo ? 'bg-white shadow text-brand-orange' : 'text-gray-500'}`}>
            {tipo === 'coleta' ? '🌅 Coleta' : '🌇 Entrega'}
          </button>
        ))}
      </div>

      {/* Campo de digitação rápida com sugestão da IA */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          placeholder="Digite o nome do cão..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
        />
        {resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-lg z-20 overflow-hidden">
            {resultados.map(pet => {
              const jaTem = idsNaLista.has(pet.id)
              return (
                <button key={pet.id} disabled={jaTem || adicionando}
                  onClick={() => adicionar({
                    pet_id: pet.id, tutor_id: pet.tutor_id,
                    endereco: pet.tutor?.endereco, telefone: pet.tutor?.telefone,
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 disabled:opacity-40">
                  <span>🐾</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">
                      {pet.nome}
                      {pet.identificador && <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>}
                    </p>
                  </div>
                  {jaTem ? <Check size={16} className="text-green-500" /> : <Plus size={16} className="text-gray-400" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sugestões da IA (padrão do dia da semana) */}
      {!aprendendo && sugestoesNovas.length > 0 && (
        <div className="bg-purple-50/60 rounded-2xl border border-purple-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-brand-purple flex items-center gap-1.5">
              <Sparkles size={15} /> Costumam vir na {diaSemanaLabel}
            </p>
            <button onClick={adicionarTodasSugestoes}
              className="text-xs font-semibold text-brand-purple bg-white border border-purple-200 rounded-lg px-2.5 py-1">
              Adicionar todos
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {sugestoesNovas.map(s => {
              const pct = s.total ? Math.round((s.vezes / s.total) * 100) : 0
              return (
                <button key={s.pet_id} disabled={adicionando}
                  onClick={() => adicionar({ pet_id: s.pet_id, tutor_id: s.tutor_id, horario: s.horario })}
                  className="flex items-center gap-3 bg-white rounded-xl border border-purple-100 px-3 py-2.5 text-left disabled:opacity-50">
                  <span className="text-lg">🐾</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{s.nome}</p>
                    <p className="text-[11px] text-brand-purple">
                      {pct}% das {diaSemanaLabel}s{s.horario && ` · costuma ${trecho === 'levar' ? 'chegar' : 'sair'} ${s.horario}`}
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-purple-100 text-brand-purple flex items-center justify-center flex-shrink-0">
                    <Plus size={16} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista atual */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : itens.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Car size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Lista vazia</p>
          <p className="text-xs mt-1">Digite um nome acima ou use as sugestões</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Lista do motorista ({itens.length})
          </p>
          <p className="text-[11px] text-gray-400 -mt-1">Arraste pela alça <GripVertical size={11} className="inline -mt-0.5" /> para mudar a ordem</p>
          {itens.map((t, idx) => (
            <div key={t.id}
              ref={el => { rowRefs.current[idx] = el }}
              className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-1.5 transition-shadow ${
                arrastandoId === t.id ? 'border-brand-purple ring-2 ring-purple-200 shadow-lg opacity-90' : 'border-gray-100'
              }`}>
              {/* Alça de arraste */}
              <div
                onPointerDown={e => iniciarArraste(e, idx)}
                className="flex items-center gap-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-gray-300"
                title="Arraste para reordenar">
                <GripVertical size={16} />
                <span className="w-7 h-7 rounded-full bg-brand-orange text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">
                  {t.pet?.nome ?? 'Pet'}
                  {t.pet?.identificador && <span className="text-gray-400 font-normal ml-1">({t.pet.identificador})</span>}
                </p>
                {t.endereco && t.endereco !== 'A definir' && (
                  <p className="text-[11px] text-gray-400 truncate">{t.endereco}</p>
                )}
              </div>

              {/* Horário de chegar em casa — opcional */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-2 py-1.5">
                <Clock size={13} className="text-gray-400" />
                <input
                  type="time"
                  value={hhmm(t.horario)}
                  onChange={e => salvarHorario(t, e.target.value)}
                  className="w-[68px] bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>

              {/* Reordenar */}
              <div className="flex flex-col">
                <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                  className="p-0.5 text-gray-300 hover:text-brand-purple disabled:opacity-30">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1}
                  className="p-0.5 text-gray-300 hover:text-brand-purple disabled:opacity-30">
                  <ChevronDown size={16} />
                </button>
              </div>

              <button onClick={() => remover(t)} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
