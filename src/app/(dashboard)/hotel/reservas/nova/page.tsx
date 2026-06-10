'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
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

  // Form fields
  const agora = new Date()
  const saida = new Date(agora)
  saida.setDate(saida.getDate() + 1)

  const [checkinPrevisto, setCheckinPrevisto] = useState(toLocalDatetimeValue(agora))
  const [checkoutPrevisto, setCheckoutPrevisto] = useState(toLocalDatetimeValue(saida))
  const [valorDiaria, setValorDiaria] = useState('')
  const [observacoes, setObservacoes] = useState('')

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

  function selecionarPet(pet: PetComTutor) {
    setPetSelecionado(pet)
    setPetBusca('')
    setPetSugestoes([])
  }

  async function salvar() {
    setErro('')
    if (!petSelecionado) { setErro('Selecione um pet.'); return }
    if (!checkinPrevisto || !checkoutPrevisto) { setErro('Informe as datas.'); return }
    if (new Date(checkinPrevisto) >= new Date(checkoutPrevisto)) {
      setErro('Check-out deve ser depois do check-in.')
      return
    }
    const valor = parseFloat(valorDiaria.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor da diária inválido.'); return }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('hospedagens').insert({
      pet_id: petSelecionado.id,
      checkin_previsto: new Date(checkinPrevisto).toISOString(),
      checkout_previsto: new Date(checkoutPrevisto).toISOString(),
      valor_diaria: valor,
      observacoes: observacoes || null,
      status: 'reservada',
    })

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
          Valor da diária (R$) *
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={valorDiaria}
          onChange={e => setValorDiaria(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
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
