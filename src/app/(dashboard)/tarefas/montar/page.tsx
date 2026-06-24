'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEmpresaId } from '@/lib/empresa'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Clock, Sparkles,
  GripVertical, Search, Trash2, UserPlus, Check,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import {
  DIAS_SEMANA, toLocalDate, hhmm, corPessoa, iniciais,
} from '@/lib/tarefas'
import type { Tarefa, Pessoa, AtividadeTarefa } from '@/types/tarefas'
import { useProfile } from '@/hooks/useProfile'

const JANELA_DIAS = 56 // 8 semanas de histórico para o padrão

type Sugestao = {
  titulo: string
  vezes: number
  total: number
  horario: string | null
  atribuido_para: string | null
}

export default function MontarTarefasPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const meuId = profile?.id ?? ''
  const perm = profile?.tarefas_perm ?? null
  const perfilCarregado = profile != null
  const isCriador = perm === 'gerente' || perm === 'criador'
  const isGerente = perm === 'gerente'

  const [data, setData] = useState(toLocalDate(new Date()))
  const [itens, setItens] = useState<Tarefa[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Form de adicionar
  const [titulo, setTitulo] = useState('')
  const [resultados, setResultados] = useState<AtividadeTarefa[]>([])
  const [horarioNovo, setHorarioNovo] = useState('')
  const [atribuidoNovo, setAtribuidoNovo] = useState<string | null>(null)
  const tituloRef = useRef<HTMLInputElement>(null)

  // Sheet de atribuir responsável a uma linha existente
  const [pickerTarefa, setPickerTarefa] = useState<string | null>(null)

  // Arrastar para reordenar
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragIdx = useRef<number | null>(null)
  const itensRef = useRef<Tarefa[]>([])
  useEffect(() => { itensRef.current = itens }, [itens])
  const aprenderToken = useRef(0)

  const pessoaMap = new Map(pessoas.map(p => [p.id, p]))
  const titulosNaLista = new Set(itens.map(t => t.titulo.trim().toLowerCase()))

  // Guarda: só quem cria entra aqui
  useEffect(() => {
    if (perfilCarregado && !isCriador) router.replace('/tarefas')
  }, [perfilCarregado, isCriador, router])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pessoas').select('*').order('nome').then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
    getEmpresaId(supabase).then(setEmpresaId)
  }, [])

  // ── Carrega tarefas do dia ────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('tarefas').select('*').eq('data', data)
      .order('ordem', { ascending: true, nullsFirst: false }).order('horario', { nullsFirst: true })
    setItens((rows as Tarefa[]) ?? [])
    setLoading(false)
  }, [data])
  useEffect(() => { carregar() }, [carregar])

  // ── Aprende o padrão do dia da semana ─────────────────────
  const aprender = useCallback(async () => {
    const token = ++aprenderToken.current
    const supabase = createClient()
    const alvo = new Date(data + 'T12:00:00')
    const diaSemana = alvo.getDay()
    const inicio = new Date(alvo); inicio.setDate(inicio.getDate() - JANELA_DIAS)

    const { data: hist } = await supabase
      .from('tarefas').select('titulo, data, horario, atribuido_para')
      .gte('data', toLocalDate(inicio)).lt('data', data)

    const rows = (hist ?? []) as Pick<Tarefa, 'titulo' | 'data' | 'horario' | 'atribuido_para'>[]
    const noDia = rows.filter(r => new Date(r.data + 'T12:00:00').getDay() === diaSemana)
    const total = new Set(noDia.map(r => r.data)).size

    type Acc = { datas: Set<string>; horarios: string[]; pessoas: string[]; titulo: string }
    const porTitulo = new Map<string, Acc>()
    for (const r of noDia) {
      const k = r.titulo.trim().toLowerCase()
      const a = porTitulo.get(k) ?? { datas: new Set<string>(), horarios: [], pessoas: [], titulo: r.titulo.trim() }
      a.datas.add(r.data)
      if (r.horario) a.horarios.push(hhmm(r.horario))
      if (r.atribuido_para) a.pessoas.push(r.atribuido_para)
      porTitulo.set(k, a)
    }
    const moda = (arr: string[]): string | null => {
      if (!arr.length) return null
      const c = new Map<string, number>()
      for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1)
      return [...c.entries()].sort((x, y) => y[1] - x[1])[0][0]
    }
    const lista: Sugestao[] = [...porTitulo.values()].map(a => ({
      titulo: a.titulo, vezes: a.datas.size, total,
      horario: moda(a.horarios), atribuido_para: moda(a.pessoas),
    }))
    lista.sort((x, y) => y.vezes - x.vezes || x.titulo.localeCompare(y.titulo))
    if (token !== aprenderToken.current) return // ignora resultado obsoleto (troca de dia rápida)
    setSugestoes(lista)
  }, [data])
  useEffect(() => { aprender() }, [aprender])

  // ── Autocomplete do catálogo ──────────────────────────────
  useEffect(() => {
    if (titulo.trim().length < 2) { setResultados([]); return }
    let ativo = true
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data: ativ } = await supabase
        .from('atividades_tarefas').select('id, nome, vezes_usada, ultimo_uso')
        .ilike('nome', `%${titulo.trim().toLowerCase()}%`)
        .order('vezes_usada', { ascending: false }).limit(6)
      if (ativo) setResultados((ativ as AtividadeTarefa[]) ?? [])
    }, 250)
    return () => { ativo = false; clearTimeout(t) }
  }, [titulo])

  // ── Adicionar tarefa ──────────────────────────────────────
  async function adicionar(nomeTarefa: string, horario: string | null, atribuido: string | null) {
    const nome = nomeTarefa.trim()
    if (!nome) return
    setSalvando(true)
    const supabase = createClient()
    const empresa = empresaId ?? await getEmpresaId(supabase)
    // Toda escrita vira atividade no catálogo (reuso futuro)
    const { data: ativId } = await supabase.rpc('registrar_atividade', { p_nome: nome, p_empresa: empresa })
    // Ordem robusta: lê o maior ordem do dia no banco (correto também ao adicionar em lote)
    const { data: ult } = await supabase.from('tarefas').select('ordem')
      .eq('data', data).order('ordem', { ascending: false, nullsFirst: false }).limit(1)
    const proxOrdem = ((ult?.[0] as { ordem: number | null } | undefined)?.ordem ?? 0) + 1
    await supabase.from('tarefas').insert({
      titulo: nome, data, horario: horario || null, ordem: proxOrdem,
      atribuido_para: atribuido || null, status: 'pendente',
      atividade_id: (ativId as string) ?? null, empresa_id: empresa, criada_por: meuId,
    })
    setSalvando(false)
    await carregar()
  }

  async function adicionarDoForm() {
    if (!titulo.trim()) return
    await adicionar(titulo, horarioNovo || null, atribuidoNovo)
    setTitulo(''); setResultados([]); setHorarioNovo(''); setAtribuidoNovo(null)
    tituloRef.current?.focus()
  }

  async function adicionarTodasSugestoes() {
    const novas = sugestoes.filter(s => !titulosNaLista.has(s.titulo.trim().toLowerCase()))
    for (const s of novas) await adicionar(s.titulo, s.horario, s.atribuido_para)
  }

  // ── Edição (apenas gerente) ───────────────────────────────
  async function salvarHorario(t: Tarefa, valor: string) {
    if (!isGerente) return
    setItens(prev => prev.map(x => x.id === t.id ? { ...x, horario: valor || null } : x))
    const supabase = createClient()
    await supabase.from('tarefas').update({ horario: valor || null }).eq('id', t.id)
  }

  async function atribuir(tarefaId: string, pessoaId: string | null) {
    if (!isGerente) return
    setItens(prev => prev.map(x => x.id === tarefaId ? { ...x, atribuido_para: pessoaId } : x))
    setPickerTarefa(null)
    const supabase = createClient()
    await supabase.from('tarefas').update({ atribuido_para: pessoaId }).eq('id', tarefaId)
  }

  async function remover(t: Tarefa) {
    if (!isGerente) return
    if (!confirm(`Excluir a tarefa "${t.titulo}"?`)) return
    setItens(prev => prev.filter(x => x.id !== t.id))
    const supabase = createClient()
    await supabase.from('tarefas').delete().eq('id', t.id)
  }

  async function persistirOrdem(arr: Tarefa[]) {
    if (!isGerente) return
    const supabase = createClient()
    await Promise.all(arr.map((t, i) => supabase.from('tarefas').update({ ordem: i + 1 }).eq('id', t.id)))
  }

  // ── Arraste (gerente) ─────────────────────────────────────
  const onPointerMoveWin = useCallback((e: PointerEvent) => {
    if (dragIdx.current == null) return
    e.preventDefault()
    const y = e.clientY
    const n = itensRef.current.length
    let alvo = n - 1
    for (let i = 0; i < n; i++) {
      const el = rowRefs.current[i]; if (!el) continue
      const r = el.getBoundingClientRect()
      if (y < r.top + r.height / 2) { alvo = i; break }
    }
    if (alvo !== dragIdx.current) {
      const de = dragIdx.current
      setItens(prev => { const arr = [...prev]; const [it] = arr.splice(de, 1); arr.splice(alvo, 0, it); return arr })
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
    if (!isGerente || dragIdx.current !== null) return
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

  const navData = (delta: number) => {
    const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() + delta); setData(toLocalDate(d))
  }

  const hoje = toLocalDate(new Date())
  const diaSemanaLabel = DIAS_SEMANA[new Date(data + 'T12:00:00').getDay()]
  const sugestoesNovas = sugestoes.filter(s => !titulosNaLista.has(s.titulo.trim().toLowerCase()))

  if (!perfilCarregado || !isCriador) {
    return <div className="flex justify-center py-24"><span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" /></div>
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tarefas" className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100"><ArrowLeft size={22} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Montar tarefas</h1>
          <p className="text-sm text-gray-400">{isGerente ? 'Criar, ordenar e atribuir' : 'Adicionar tarefas'}</p>
        </div>
      </div>

      {/* Navegação dia */}
      <div className="flex items-center justify-between">
        <button onClick={() => navData(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronLeft size={22} /></button>
        <p className="font-bold text-gray-800 capitalize">
          {data === hoje ? 'Hoje' : formatDate(data + 'T12:00:00', "EEE, dd 'de' MMMM")} · {diaSemanaLabel}
        </p>
        <button onClick={() => navData(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"><ChevronRight size={22} /></button>
      </div>

      {/* Form de adicionar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={tituloRef}
            placeholder="Escreva a tarefa..."
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') adicionarDoForm() }}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
          />
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-lg z-20 overflow-hidden">
              {resultados.map(a => (
                <button key={a.id} onClick={() => { setTitulo(a.nome); setResultados([]) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                  <Sparkles size={14} className="text-brand-purple" />
                  <span className="flex-1 text-sm font-medium text-gray-800">{a.nome}</span>
                  <span className="text-[10px] text-gray-400">{a.vezes_usada}x</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* horário + responsável */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-2">
            <Clock size={14} className="text-gray-400" />
            <input type="time" value={horarioNovo} onChange={e => setHorarioNovo(e.target.value)}
              className="w-[74px] bg-transparent text-sm text-gray-700 outline-none" />
          </div>
          <span className="text-xs text-gray-400">horário opcional</span>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Responsável (toque para marcar)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pessoas.map(p => {
              const sel = atribuidoNovo === p.id
              return (
                <button key={p.id} onClick={() => setAtribuidoNovo(sel ? null : p.id)}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 w-14 ${sel ? '' : 'opacity-70'}`}>
                  <span className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${corPessoa(p.id)} ${sel ? 'ring-2 ring-brand-purple ring-offset-1' : ''}`}>
                    {iniciais(p.nome)}
                    {sel && <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-brand-purple text-white flex items-center justify-center"><Check size={10} /></span>}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate w-full text-center">{p.nome.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={adicionarDoForm} disabled={!titulo.trim() || salvando}
          className="py-3 rounded-2xl bg-brand-purple text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {salvando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={18} /> Adicionar tarefa</>}
        </button>
      </div>

      {/* Sugestões de IA */}
      {sugestoesNovas.length > 0 && (
        <div className="bg-purple-50/60 rounded-2xl border border-purple-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-brand-purple flex items-center gap-1.5">
              <Sparkles size={15} /> Costumam ser feitas na {diaSemanaLabel}
            </p>
            <button onClick={adicionarTodasSugestoes} disabled={salvando}
              className="text-xs font-semibold text-brand-purple bg-white border border-purple-200 rounded-lg px-2.5 py-1 disabled:opacity-50">
              Adicionar todas
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {sugestoesNovas.map(s => {
              const pct = s.total ? Math.round((s.vezes / s.total) * 100) : 0
              const resp = s.atribuido_para ? pessoaMap.get(s.atribuido_para) : null
              return (
                <button key={s.titulo} disabled={salvando}
                  onClick={() => adicionar(s.titulo, s.horario, s.atribuido_para)}
                  className="flex items-center gap-3 bg-white rounded-xl border border-purple-100 px-3 py-2.5 text-left disabled:opacity-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{s.titulo}</p>
                    <p className="text-[11px] text-brand-purple">
                      {pct}% das {diaSemanaLabel}s{s.horario && ` · ${s.horario}`}{resp && ` · ${resp.nome.split(' ')[0]}`}
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-purple-100 text-brand-purple flex items-center justify-center flex-shrink-0"><Plus size={16} /></span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista do dia */}
      {loading ? (
        <div className="flex justify-center py-12"><span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" /></div>
      ) : itens.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="font-medium">Nenhuma tarefa neste dia</p>
          <p className="text-xs mt-1">Escreva acima ou use as sugestões</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Tarefas do dia ({itens.length}){isGerente && ' · arraste pela alça para ordenar'}
          </p>
          {itens.map((t, idx) => {
            const resp = t.atribuido_para ? pessoaMap.get(t.atribuido_para) : null
            return (
              <div key={t.id}
                ref={el => { rowRefs.current[idx] = el }}
                className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-2 ${arrastandoId === t.id ? 'border-brand-purple ring-2 ring-purple-200 shadow-lg' : 'border-gray-100'}`}>
                {isGerente ? (
                  <div onPointerDown={e => iniciarArraste(e, idx)}
                    className="flex items-center gap-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-gray-300" title="Arraste para reordenar">
                    <GripVertical size={16} />
                    <span className="w-6 h-6 rounded-full bg-brand-purple text-white text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                  </div>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-brand-purple text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                )}

                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${t.status === 'concluida' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.titulo}</p>
                  <button
                    onClick={() => isGerente && setPickerTarefa(t.id)}
                    disabled={!isGerente}
                    className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 disabled:cursor-default">
                    {resp ? (
                      <>
                        <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${corPessoa(resp.id)}`}>{iniciais(resp.nome)}</span>
                        {resp.nome.split(' ')[0]}
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400"><UserPlus size={12} /> {isGerente ? 'atribuir' : 'sem responsável'}</span>
                    )}
                  </button>
                </div>

                {/* horário */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-2 py-1.5">
                  <Clock size={13} className="text-gray-400" />
                  <input type="time" value={hhmm(t.horario)} disabled={!isGerente}
                    onChange={e => salvarHorario(t, e.target.value)}
                    className="w-[64px] bg-transparent text-sm text-gray-700 outline-none disabled:text-gray-400" />
                </div>

                {isGerente && (
                  <button onClick={() => remover(t)} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0"><Trash2 size={16} /></button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet de atribuir responsável */}
      {pickerTarefa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setPickerTarefa(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Atribuir a quem?</h2>
              <button onClick={() => setPickerTarefa(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><X size={16} /></button>
            </div>
            <button onClick={() => atribuir(pickerTarefa, null)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left text-gray-500">
              <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></span>
              Ninguém (sem responsável)
            </button>
            {pessoas.map(p => (
              <button key={p.id} onClick={() => atribuir(pickerTarefa, p.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${corPessoa(p.id)}`}>{iniciais(p.nome)}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{p.nome}</p>
                  <p className="text-xs text-gray-400 capitalize">{p.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
