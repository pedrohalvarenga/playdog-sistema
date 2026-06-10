'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, X, Car } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string; telefone?: string | null; endereco?: string | null } }

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function NovoAgendamentoPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // Pet search
  const [petBusca, setPetBusca] = useState('')
  const [petSugestoes, setPetSugestoes] = useState<PetComTutor[]>([])
  const [petSelecionado, setPetSelecionado] = useState<PetComTutor | null>(null)
  const [buscando, setBuscando] = useState(false)
  const buscaRef = useRef<HTMLInputElement>(null)

  // Form
  const [data, setData] = useState(toLocalDate(new Date()))
  const [horaChegada, setHoraChegada] = useState('09:00')
  const [horaSaida, setHoraSaida] = useState('11:00')
  const [descricao, setDescricao] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Taxi
  const [taxiDog, setTaxiDog] = useState(false)
  const [taxiTipo, setTaxiTipo] = useState<'buscar' | 'levar' | 'ambos'>('ambos')
  const [taxiEndereco, setTaxiEndereco] = useState('')
  const [valorTaxi, setValorTaxi] = useState('')

  // Busca com debounce
  useEffect(() => {
    if (petBusca.length < 2) { setPetSugestoes([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data: pets } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome, telefone, endereco)')
        .eq('ativo', true)
        .or(`nome.ilike.%${petBusca.toLowerCase()}%,identificador.ilike.%${petBusca.toLowerCase()}%`)
        .limit(8)
      setPetSugestoes((pets as PetComTutor[]) ?? [])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [petBusca])

  function selecionarPet(pet: PetComTutor) {
    setPetSelecionado(pet)
    setPetBusca('')
    setPetSugestoes([])
    // Preenche endereço do táxi com o endereço do tutor
    if (pet.tutor?.endereco) setTaxiEndereco(pet.tutor.endereco)
  }

  async function salvar() {
    setErro('')
    if (!petSelecionado) { setErro('Selecione um pet.'); return }
    if (!data) { setErro('Informe a data.'); return }
    if (!horaChegada) { setErro('Informe o horário de chegada.'); return }
    if (!descricao.trim()) { setErro('Informe a descrição do serviço.'); return }
    if (taxiDog && !taxiEndereco.trim()) { setErro('Informe o endereço para o Taxi Dog.'); return }

    setSaving(true)
    const supabase = createClient()

    const { data: agendamento, error } = await supabase
      .from('agendamentos_banho_tosa')
      .insert({
        pet_id: petSelecionado.id,
        data,
        hora_chegada: horaChegada,
        hora_saida_prevista: horaSaida || null,
        descricao_servico: descricao.trim(),
        valor_servico: valorServico ? parseFloat(valorServico.replace(',', '.')) : null,
        taxi_dog: taxiDog,
        taxi_tipo: taxiDog ? taxiTipo : null,
        taxi_endereco: taxiDog ? taxiEndereco.trim() : null,
        valor_taxi: taxiDog && valorTaxi ? parseFloat(valorTaxi.replace(',', '.')) : null,
        observacoes: observacoes.trim() || null,
        status: 'agendado',
      })
      .select('id')
      .single()

    if (error) { setErro(error.message); setSaving(false); return }

    // Passageiro entra sozinho na lista do dia: ida e volta independentes.
    // buscar = só a ida é nossa | levar = só a volta é nossa | ambos = as duas
    if (taxiDog && agendamento) {
      const meioIda   = taxiTipo === 'buscar' || taxiTipo === 'ambos' ? 'playdog' : 'tutor'
      const meioVolta = taxiTipo === 'levar'  || taxiTipo === 'ambos' ? 'playdog' : 'tutor'
      const base = {
        origem: 'banho_tosa',
        origem_id: agendamento.id,
        pet_id: petSelecionado.id,
        data,
        endereco: taxiEndereco.trim(),
        telefone: petSelecionado.tutor?.telefone ?? null,
        status: 'pendente',
      }
      await supabase.from('transportes').insert([
        { ...base, tipo: 'buscar', meio: meioIda,   horario: horaChegada },
        { ...base, tipo: 'levar',  meio: meioVolta, horario: horaSaida || horaChegada },
      ])
    }

    router.push('/banho-tosa')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/banho-tosa" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Novo Agendamento</h1>
      </div>

      {/* Pet */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Pet *</label>
        {petSelecionado ? (
          <div className="flex items-center gap-3 bg-teal-50 rounded-2xl px-4 py-3">
            <span className="text-xl">🐾</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900">
                {petSelecionado.nome}
                {petSelecionado.identificador && (
                  <span className="text-gray-400 font-normal ml-1">({petSelecionado.identificador})</span>
                )}
              </p>
              <p className="text-xs text-gray-500">{petSelecionado.tutor?.nome}</p>
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
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
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
                    <span>🐾</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {pet.nome}
                        {pet.identificador && <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>}
                      </p>
                      <p className="text-xs text-gray-500">{pet.tutor?.nome}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {buscando && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Descrição do serviço */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Descrição do serviço *
        </label>
        <input
          type="text"
          placeholder="Ex: banho + tosa higiênica, máquina 2"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      {/* Data + Horários */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data *</label>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Chegada *</label>
          <input
            type="time"
            value={horaChegada}
            onChange={e => setHoraChegada(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Saída prevista</label>
          <input
            type="time"
            value={horaSaida}
            onChange={e => setHoraSaida(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
          />
        </div>
      </div>

      {/* Valor do serviço */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do serviço (R$)</label>
        <input
          type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
          value={valorServico}
          onChange={e => setValorServico(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      {/* Taxi Dog */}
      <div className="bg-orange-50 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car size={20} className="text-brand-orange" />
            <span className="font-semibold text-gray-800">Taxi Dog</span>
          </div>
          <button
            type="button"
            onClick={() => setTaxiDog(t => !t)}
            className={`w-12 h-6 rounded-full transition-colors relative ${taxiDog ? 'bg-brand-orange' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${taxiDog ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {taxiDog && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tipo de serviço</label>
              <div className="grid grid-cols-3 gap-2">
                {(['buscar', 'levar', 'ambos'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTaxiTipo(t)}
                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      taxiTipo === t
                        ? 'border-brand-orange bg-orange-50 text-brand-orange'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {t === 'buscar' ? 'Buscar' : t === 'levar' ? 'Levar' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Endereço</label>
              <input
                type="text"
                placeholder="Endereço completo"
                value={taxiEndereco}
                onChange={e => setTaxiEndereco(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do Taxi Dog (R$)</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                value={valorTaxi}
                onChange={e => setValorTaxi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm bg-white"
              />
            </div>
          </>
        )}
      </div>

      {/* Observações */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observações</label>
        <textarea
          rows={3}
          placeholder="Comportamento, medicação, preferências..."
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}
        className="bg-brand-teal hover:bg-teal-600">
        Salvar agendamento
      </Button>
    </div>
  )
}
