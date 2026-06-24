'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Coffee, UtensilsCrossed, Moon, Dog, Building2, Utensils,
  ChevronLeft, ChevronRight, Pill, NotebookPen, Eye, EyeOff, type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { hojeLocal, diaLocal } from '@/lib/datas'

type Local = 'creche' | 'hotel'
type StatusRefeicao = 'comeu' | 'ainda_nao' | 'nao_quis_1x' | 'nao_quis_2x'
type StatusCampo = 'status_cafe' | 'status_almoco' | 'status_janta'
type OffCampo = 'cafe_off' | 'almoco_off' | 'janta_off'

interface PetLista {
  petId: string
  nome: string
  identificador?: string | null
  fotoUrl?: string | null
  tutor?: string | null
  local: Local
}

interface RegistroState {
  status_cafe: StatusRefeicao | null
  status_almoco: StatusRefeicao | null
  status_janta: StatusRefeicao | null
  instrucao_refeicao: string
  medicacao: string
  sem_alimentacao: boolean
  cafe_off: boolean
  almoco_off: boolean
  janta_off: boolean
}

const VAZIO: RegistroState = {
  status_cafe: null, status_almoco: null, status_janta: null,
  instrucao_refeicao: '', medicacao: '',
  sem_alimentacao: false, cafe_off: false, almoco_off: false, janta_off: false,
}

// Cores da Play Dog: roxo (ainda não) e laranja (não quis 1x); verde/vermelho mantidos.
const STATUS_OPCOES: { valor: StatusRefeicao; label: string; sel: string; unsel: string }[] = [
  { valor: 'comeu',       label: 'Comeu',       sel: 'bg-green-500 text-white',   unsel: 'bg-green-50 text-green-700 border border-green-200' },
  { valor: 'ainda_nao',   label: 'Ainda não',   sel: 'bg-brand-purple text-white', unsel: 'bg-purple-50 text-brand-purple border border-purple-200' },
  { valor: 'nao_quis_1x', label: 'Não quis 1x', sel: 'bg-brand-orange text-white', unsel: 'bg-orange-50 text-brand-orange border border-orange-200' },
  { valor: 'nao_quis_2x', label: 'Não quis 2x', sel: 'bg-red-500 text-white',     unsel: 'bg-red-50 text-red-700 border border-red-200' },
]

const PERIODOS: { campo: StatusCampo; off: OffCampo; label: string; Icon: LucideIcon }[] = [
  { campo: 'status_cafe',   off: 'cafe_off',   label: 'Café',   Icon: Coffee },
  { campo: 'status_almoco', off: 'almoco_off', label: 'Almoço', Icon: UtensilsCrossed },
  { campo: 'status_janta',  off: 'janta_off',  label: 'Janta',  Icon: Moon },
]

type PetJoin = { id: string; nome: string; identificador: string | null; foto_url: string | null; tutor: { nome: string } | null }

function toLista(pet: PetJoin, local: Local): PetLista {
  return { petId: pet.id, nome: pet.nome, identificador: pet.identificador, fotoUrl: pet.foto_url, tutor: pet.tutor?.nome ?? null, local }
}

export default function AlimentacaoMedicacaoPage() {
  const [dia, setDia] = useState(() => hojeLocal())
  const [visao, setVisao] = useState<Local>('creche')
  const [petsCreche, setPetsCreche] = useState<PetLista[]>([])
  const [petsHotel, setPetsHotel] = useState<PetLista[]>([])
  const [registros, setRegistros] = useState<Record<string, RegistroState>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    })()
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [{ data: pres }, { data: hosp }] = await Promise.all([
      supabase
        .from('presencas')
        .select('pet:pets(id, nome, identificador, foto_url, tutor:tutores(nome))')
        .eq('data', dia)
        .order('checkin_at'),
      supabase
        .from('hospedagens')
        .select('checkin_previsto, checkout_previsto, pet:pets(id, nome, identificador, foto_url, tutor:tutores(nome))')
        .not('status', 'in', '(cancelada)')
        .order('checkin_previsto'),
    ])

    const creche: PetLista[] = ((pres ?? []) as { pet: PetJoin | null }[])
      .filter(r => r.pet)
      .map(r => toLista(r.pet as PetJoin, 'creche'))
      .sort((a, b) => a.nome.localeCompare(b.nome))

    const hotel: PetLista[] = ((hosp ?? []) as { checkin_previsto: string; checkout_previsto: string; pet: PetJoin | null }[])
      .filter(h => {
        const ci = diaLocal(new Date(h.checkin_previsto))
        const co = diaLocal(new Date(h.checkout_previsto))
        return ci <= dia && co > dia && !!h.pet
      })
      .map(h => toLista(h.pet as PetJoin, 'hotel'))
      .sort((a, b) => a.nome.localeCompare(b.nome))

    const ids = Array.from(new Set([...creche, ...hotel].map(p => p.petId)))
    const regMap: Record<string, RegistroState> = {}

    if (ids.length) {
      const [{ data: hojeRows }, { data: histRows }] = await Promise.all([
        supabase
          .from('registros_alimentacao')
          .select('pet_id, status_cafe, status_almoco, status_janta, instrucao_refeicao, medicacao, sem_alimentacao, cafe_off, almoco_off, janta_off')
          .eq('data', dia).in('pet_id', ids),
        supabase
          .from('registros_alimentacao')
          .select('pet_id, instrucao_refeicao, medicacao, cafe_off, almoco_off, janta_off, data')
          .lt('data', dia).in('pet_id', ids)
          .order('data', { ascending: false }),
      ])

      // Carry-over: última instrução/medicação não-vazia e a config de refeições do cão.
      const ultInstr: Record<string, string> = {}
      const ultMed: Record<string, string> = {}
      const ultOff: Record<string, { cafe_off: boolean; almoco_off: boolean; janta_off: boolean }> = {}
      for (const h of (histRows ?? []) as { pet_id: string; instrucao_refeicao: string | null; medicacao: string | null; cafe_off: boolean | null; almoco_off: boolean | null; janta_off: boolean | null }[]) {
        if (ultInstr[h.pet_id] === undefined && h.instrucao_refeicao) ultInstr[h.pet_id] = h.instrucao_refeicao
        if (ultMed[h.pet_id] === undefined && h.medicacao) ultMed[h.pet_id] = h.medicacao
        if (ultOff[h.pet_id] === undefined) ultOff[h.pet_id] = { cafe_off: !!h.cafe_off, almoco_off: !!h.almoco_off, janta_off: !!h.janta_off }
      }

      const hojeByPet: Record<string, RegistroState> = {}
      for (const r of (hojeRows ?? []) as Record<string, unknown>[]) {
        hojeByPet[r.pet_id as string] = {
          status_cafe: (r.status_cafe as StatusRefeicao) ?? null,
          status_almoco: (r.status_almoco as StatusRefeicao) ?? null,
          status_janta: (r.status_janta as StatusRefeicao) ?? null,
          instrucao_refeicao: (r.instrucao_refeicao as string) ?? '',
          medicacao: (r.medicacao as string) ?? '',
          sem_alimentacao: !!r.sem_alimentacao,
          cafe_off: !!r.cafe_off,
          almoco_off: !!r.almoco_off,
          janta_off: !!r.janta_off,
        }
      }

      for (const id of ids) {
        // Já há registro hoje → vale o de hoje. Senão, repete a última anotação e a config de refeições.
        regMap[id] = hojeByPet[id] ?? {
          ...VAZIO,
          instrucao_refeicao: ultInstr[id] ?? '',
          medicacao: ultMed[id] ?? '',
          cafe_off: ultOff[id]?.cafe_off ?? false,
          almoco_off: ultOff[id]?.almoco_off ?? false,
          janta_off: ultOff[id]?.janta_off ?? false,
        }
      }
    }

    setPetsCreche(creche)
    setPetsHotel(hotel)
    setRegistros(regMap)
    setLoading(false)
  }, [dia])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(pet: PetLista, novo: RegistroState) {
    setRegistros(prev => ({ ...prev, [pet.petId]: novo }))
    const supabase = createClient()
    await supabase.from('registros_alimentacao').upsert({
      pet_id: pet.petId,
      data: dia,
      local: pet.local,
      status_cafe: novo.status_cafe,
      status_almoco: novo.status_almoco,
      status_janta: novo.status_janta,
      instrucao_refeicao: novo.instrucao_refeicao.trim() || null,
      medicacao: novo.medicacao.trim() || null,
      sem_alimentacao: novo.sem_alimentacao,
      cafe_off: novo.cafe_off,
      almoco_off: novo.almoco_off,
      janta_off: novo.janta_off,
      registrado_por: userId,
    }, { onConflict: 'pet_id,data' })
  }

  function alternarStatus(pet: PetLista, campo: StatusCampo, valor: StatusRefeicao) {
    const atual = registros[pet.petId] ?? VAZIO
    const novo = { ...atual, [campo]: atual[campo] === valor ? null : valor }
    salvar(pet, novo)
  }

  function alternarRefeicao(pet: PetLista, off: OffCampo, campo: StatusCampo) {
    const atual = registros[pet.petId] ?? VAZIO
    const novoOff = !atual[off]
    const novo = { ...atual, [off]: novoOff }
    if (novoOff) novo[campo] = null // desabilitou: limpa o status daquela refeição
    salvar(pet, novo)
  }

  function alternarSemAlimentacao(pet: PetLista) {
    const atual = registros[pet.petId] ?? VAZIO
    const novoSem = !atual.sem_alimentacao
    const novo = { ...atual, sem_alimentacao: novoSem }
    if (novoSem) { novo.status_cafe = null; novo.status_almoco = null; novo.status_janta = null }
    salvar(pet, novo)
  }

  function mudarTexto(petId: string, campo: 'instrucao_refeicao' | 'medicacao', valor: string) {
    setRegistros(prev => ({ ...prev, [petId]: { ...(prev[petId] ?? VAZIO), [campo]: valor } }))
  }

  const lista = visao === 'creche' ? petsCreche : petsHotel
  const hoje = hojeLocal()
  const comeramCount = lista.filter(p => {
    const r = registros[p.petId]
    return r && !r.sem_alimentacao && (r.status_cafe === 'comeu' || r.status_almoco === 'comeu' || r.status_janta === 'comeu')
  }).length

  function navDia(passo: number) {
    const d = new Date(dia + 'T12:00:00')
    d.setDate(d.getDate() + passo)
    setDia(diaLocal(d))
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alimentação &amp; Medicação</h1>
          <p className="text-sm text-gray-400">{formatDate(dia + 'T12:00:00', "dd 'de' MMMM, yyyy")}</p>
        </div>
      </div>

      {/* Navegação de dia */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-3 py-2">
        <button onClick={() => navDia(-1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 text-sm">
          {dia === hoje ? 'Hoje' : formatDate(dia + 'T12:00:00', "EEE, dd/MM")}
        </span>
        <button onClick={() => navDia(1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Toggle Creche / Hotel */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        <button
          onClick={() => setVisao('creche')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${visao === 'creche' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
        >
          <Dog size={15} /> Creche · {petsCreche.length}
        </button>
        <button
          onClick={() => setVisao('hotel')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${visao === 'hotel' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
        >
          <Building2 size={15} /> Hotel · {petsHotel.length}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Utensils size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">
            {visao === 'creche' ? 'Nenhum cão na creche neste dia' : 'Nenhum cão no hotel neste dia'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {visao === 'creche' ? 'Creche' : 'Hotel'} — {lista.length} {lista.length !== 1 ? 'cães' : 'cão'} · {comeramCount} já comeram
          </p>
          <div className="flex flex-col gap-3">
            {lista.map(pet => (
              <PetCard
                key={pet.petId}
                pet={pet}
                registro={registros[pet.petId] ?? VAZIO}
                onStatus={alternarStatus}
                onRefeicao={alternarRefeicao}
                onSemAlimentacao={alternarSemAlimentacao}
                onTexto={mudarTexto}
                onBlurSalvar={() => salvar(pet, registros[pet.petId] ?? VAZIO)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PetCard({
  pet, registro, onStatus, onRefeicao, onSemAlimentacao, onTexto, onBlurSalvar,
}: {
  pet: PetLista
  registro: RegistroState
  onStatus: (pet: PetLista, campo: StatusCampo, valor: StatusRefeicao) => void
  onRefeicao: (pet: PetLista, off: OffCampo, campo: StatusCampo) => void
  onSemAlimentacao: (pet: PetLista) => void
  onTexto: (petId: string, campo: 'instrucao_refeicao' | 'medicacao', valor: string) => void
  onBlurSalvar: () => void
}) {
  const sem = registro.sem_alimentacao

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Cabeçalho do pet */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {pet.fotoUrl ? (
            <img src={pet.fotoUrl} alt={pet.nome} className="w-full h-full object-cover" />
          ) : (
            <Dog size={21} className="text-brand-purple" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">
            {pet.nome}
            {pet.identificador && <span className="text-gray-400 font-normal text-sm ml-1">({pet.identificador})</span>}
          </p>
          {pet.tutor && <p className="text-sm text-gray-500 truncate">{pet.tutor}</p>}
        </div>
        {registro.medicacao.trim() && (
          <span className="inline-flex items-center gap-1 bg-purple-100 text-brand-purple text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
            <Pill size={11} /> Medicação
          </span>
        )}
      </div>

      {/* Creche: não levou ração hoje */}
      {pet.local === 'creche' && (
        <button
          onClick={() => onSemAlimentacao(pet)}
          className={`mt-3 w-full flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${sem ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}
        >
          <span className={`flex items-center gap-2 text-sm font-medium ${sem ? 'text-brand-orange' : 'text-gray-600'}`}>
            <Utensils size={15} className={sem ? 'text-brand-orange' : 'text-gray-400'} /> Não levou ração hoje
          </span>
          <span className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${sem ? 'bg-brand-orange' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sem ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
        </button>
      )}

      {sem ? (
        <div className="mt-3 text-xs text-gray-400 italic">
          Sem ração hoje — ficha de alimentação oculta.
        </div>
      ) : (
        <>
          {/* Refeições */}
          {PERIODOS.map(({ campo, off, label, Icon }) => {
            const desativada = registro[off]
            return (
              <div key={campo} className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} className={desativada ? 'text-gray-300' : 'text-gray-500'} />
                    <span className={`text-xs font-semibold ${desativada ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{label}</span>
                  </div>
                  <button
                    onClick={() => onRefeicao(pet, off, campo)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-full"
                  >
                    {desativada ? <><Eye size={11} /> ativar</> : <><EyeOff size={11} /> não se aplica</>}
                  </button>
                </div>
                {desativada ? (
                  <p className="text-[11px] text-gray-300 italic pl-5">não se aplica a este cão</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {STATUS_OPCOES.map(op => {
                      const ativo = registro[campo] === op.valor
                      return (
                        <button
                          key={op.valor}
                          onClick={() => onStatus(pet, campo, op.valor)}
                          className={`text-[11px] font-semibold py-2 px-1 rounded-lg leading-tight text-center transition-colors ${ativo ? op.sel : op.unsel}`}
                        >
                          {op.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Instrução da refeição */}
          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              <NotebookPen size={13} className="text-gray-400" /> Instrução da refeição
            </label>
            <textarea
              rows={2}
              value={registro.instrucao_refeicao}
              onChange={e => onTexto(pet.petId, 'instrucao_refeicao', e.target.value)}
              onBlur={onBlurSalvar}
              placeholder="Ex: 1 medida de ração + sachê, molhar a ração..."
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
            />
          </div>
        </>
      )}

      {/* Medicação (sempre disponível) */}
      <div className="mt-3">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          <Pill size={13} className="text-brand-purple" /> Medicação
        </label>
        <textarea
          rows={2}
          value={registro.medicacao}
          onChange={e => onTexto(pet.petId, 'medicacao', e.target.value)}
          onBlur={onBlurSalvar}
          placeholder="Ex: Apoquel 16 mg — 1 comp. no café, dar com comida..."
          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
        />
      </div>
    </div>
  )
}
