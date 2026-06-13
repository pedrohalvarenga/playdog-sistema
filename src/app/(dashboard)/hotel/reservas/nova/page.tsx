'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { calcNoites } from '@/lib/hotel'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string } }

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NovaReservaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // Pet search
  const [petBusca, setPetBusca] = useState('')
  const [petSugestoes, setPetSugestoes] = useState<PetComTutor[]>([])
  const [petSelecionado, setPetSelecionado] = useState<PetComTutor | null>(null)
  const [buscando, setBuscando] = useState(false)
  const buscaRef = useRef<HTMLInputElement>(null)

  // Irmãos (outros cães do mesmo tutor)
  const [irmaos, setIrmaos] = useState<PetComTutor[]>([])
  const [irmaosSelecionados, setIrmaosSelecionados] = useState<string[]>([])

  // Form fields
  const agora = new Date()
  const saida = new Date(agora)
  saida.setDate(saida.getDate() + 1)

  const [checkinPrevisto, setCheckinPrevisto] = useState(toLocalDatetimeValue(agora))
  const [checkoutPrevisto, setCheckoutPrevisto] = useState(toLocalDatetimeValue(saida))
  const [valorPacote, setValorPacote] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const noites = checkinPrevisto && checkoutPrevisto ? calcNoites(checkinPrevisto, checkoutPrevisto) : 0
  const valorPacoteNum = parseFloat(valorPacote.replace(',', '.')) || 0
  const diariaEquivalente = noites > 0 && valorPacoteNum > 0 ? valorPacoteNum / noites : 0

  // Busca de pets com debounce
  useEffect(() => {
    if (petBusca.length < 2) { setPetSugestoes([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      const supabase = createClient()
      const lower = petBusca.toLowerCase()
      const { data } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome)')
        .eq('ativo', true)
        .or(`nome.ilike.%${lower}%,identificador.ilike.%${lower}%`)
        .limit(8)
      setPetSugestoes((data as PetComTutor[]) ?? [])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [petBusca])

  async function selecionarPet(pet: PetComTutor) {
    setPetSelecionado(pet)
    setPetBusca('')
    setPetSugestoes([])
    setIrmaosSelecionados([])
    // Busca outros cães do mesmo tutor ("irmãos")
    const supabase = createClient()
    const { data } = await supabase
      .from('pets')
      .select('*, tutor:tutores(nome)')
      .eq('tutor_id', pet.tutor_id)
      .eq('ativo', true)
      .neq('id', pet.id)
    setIrmaos((data as PetComTutor[]) ?? [])
  }

  function toggleIrmao(id: string) {
    setIrmaosSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function salvar() {
    setErro('')
    if (!petSelecionado) { setErro('Selecione um pet.'); return }
    if (!checkinPrevisto || !checkoutPrevisto) { setErro('Informe as datas.'); return }
    if (new Date(checkinPrevisto) >= new Date(checkoutPrevisto)) {
      setErro('Check-out deve ser depois do check-in.')
      return
    }
    const valor = parseFloat(valorPacote.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor do pacote inválido.'); return }

    setSaving(true)
    const supabase = createClient()
    const nNoites = calcNoites(checkinPrevisto, checkoutPrevisto)

    // Todos os pets da reserva: o selecionado + irmãos marcados
    const petsReserva = [petSelecionado.id, ...irmaosSelecionados]
    const grupoId = petsReserva.length > 1 ? crypto.randomUUID() : null

    // Rateio do valor total entre os pets (último leva o resto dos centavos)
    const cota = Math.floor((valor / petsReserva.length) * 100) / 100
    const ultimaCota = Math.round((valor - cota * (petsReserva.length - 1)) * 100) / 100

    const { error } = await supabase.from('hospedagens').insert(
      petsReserva.map((petId, i) => {
        const valorPet = i === petsReserva.length - 1 ? ultimaCota : cota
        return {
          pet_id: petId,
          checkin_previsto: new Date(checkinPrevisto).toISOString(),
          checkout_previsto: new Date(checkoutPrevisto).toISOString(),
          valor_pacote: valorPet,
          valor_diaria: nNoites > 0 ? Math.round((valorPet / nNoites) * 100) / 100 : 0,
          observacoes: observacoes || null,
          status: 'reservada',
          grupo_id: grupoId,
        }
      })
    )

    if (error) {
      setErro(error.message)
      setSaving(false)
      return
    }
    router.push('/hotel/reservas')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hotel/reservas" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nova Reserva</h1>
      </div>

      {/* Pet */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
          Pet *
        </label>
        {petSelecionado ? (
          <div className="flex items-center gap-3 bg-purple-50 rounded-2xl px-4 py-3">
            <span className="text-xl">🐾</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{petSelecionado.nome}</p>
              <p className="text-xs text-gray-500">{petSelecionado.tutor.nome}</p>
            </div>
            <button onClick={() => setPetSelecionado(null)} className="p-1 text-gray-400">
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={buscaRef}
              type="text"
              placeholder="Digite o nome do pet..."
              value={petBusca}
              onChange={e => setPetBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              autoFocus
            />
            {petSugestoes.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-lg z-10 overflow-hidden">
                {petSugestoes.map(pet => (
                  <button
                    key={pet.id}
                    onClick={() => selecionarPet(pet)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                  >
                    <span className="text-base">🐾</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {pet.nome}
                        {pet.identificador && <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>}
                      </p>
                      <p className="text-xs text-gray-500">{pet.tutor.nome}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {buscando && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Irmãos do mesmo tutor */}
      {petSelecionado && irmaos.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-900">
            {petSelecionado.tutor.nome.split(' ')[0]} tem {irmaos.length === 1 ? 'outro cão' : 'outros cães'}.
            {' '}{irmaos.length === 1 ? 'Ele também ficará hospedado?' : 'Eles também ficarão hospedados?'}
          </p>
          <div className="flex flex-col gap-2">
            {irmaos.map(irmao => {
              const marcado = irmaosSelecionados.includes(irmao.id)
              return (
                <button
                  key={irmao.id}
                  type="button"
                  onClick={() => toggleIrmao(irmao.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-colors ${
                    marcado ? 'border-brand-orange bg-white' : 'border-transparent bg-white/60'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    marcado ? 'bg-brand-orange border-brand-orange text-white' : 'border-gray-300 bg-white'
                  }`}>
                    {marcado && <span className="text-xs font-bold">✓</span>}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{irmao.nome}</p>
                    {irmao.identificador && <p className="text-xs text-gray-400">{irmao.identificador}</p>}
                  </div>
                </button>
              )
            })}
          </div>
          {irmaosSelecionados.length > 0 && (
            <p className="text-xs text-orange-700">
              Reserva em grupo: o valor total será dividido automaticamente entre os {irmaosSelecionados.length + 1} cães.
            </p>
          )}
        </div>
      )}

      {/* Datas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
            Check-in *
          </label>
          <input
            type="datetime-local"
            value={checkinPrevisto}
            onChange={e => setCheckinPrevisto(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
            Check-out *
          </label>
          <input
            type="datetime-local"
            value={checkoutPrevisto}
            onChange={e => setCheckoutPrevisto(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          />
        </div>
      </div>

      {/* Valor */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Valor total do pacote (R$) *
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={valorPacote}
          onChange={e => setValorPacote(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
        {noites > 0 && valorPacoteNum > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {noites} noite{noites !== 1 ? 's' : ''} — equivale a R$ {diariaEquivalente.toFixed(2).replace('.', ',')} por diária
            {irmaosSelecionados.length > 0 && (
              <> · rateio: R$ {(valorPacoteNum / (irmaosSelecionados.length + 1)).toFixed(2).replace('.', ',')} por cão</>
            )}
          </p>
        )}
      </div>

      {/* Observações */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Observações
        </label>
        <textarea
          rows={3}
          placeholder="Medicação, comportamento, rotina..."
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>
        Salvar reserva
      </Button>
    </div>
  )
}
