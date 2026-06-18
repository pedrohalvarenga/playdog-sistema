'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string; telefone?: string | null } }

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function NovoAgendamentoVetPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // Busca de pet
  const [petBusca, setPetBusca] = useState('')
  const [petSugestoes, setPetSugestoes] = useState<PetComTutor[]>([])
  const [petSelecionado, setPetSelecionado] = useState<PetComTutor | null>(null)
  const [buscando, setBuscando] = useState(false)
  const buscaRef = useRef<HTMLInputElement>(null)

  // Form
  const [data, setData] = useState(toLocalDate(new Date()))
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (petBusca.length < 2) { setPetSugestoes([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data: pets } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome, telefone)')
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
  }

  async function salvar() {
    setErro('')
    if (!petSelecionado) { setErro('Selecione um pet.'); return }
    if (!data) { setErro('Informe a data.'); return }
    if (!motivo.trim()) { setErro('Informe o motivo do atendimento.'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('agendamentos_veterinario')
      .insert({
        pet_id: petSelecionado.id,
        data,
        hora: hora || null,
        motivo: motivo.trim(),
        observacoes: observacoes.trim() || null,
        status: 'agendado',
        registrado_por: user?.id ?? null,
      })

    if (error) { setErro(error.message); setSaving(false); return }
    router.push('/veterinario')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/veterinario" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Novo atendimento</h1>
      </div>

      {/* Pet */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Pet *</label>
        {petSelecionado ? (
          <div className="flex items-center gap-3 bg-rose-50 rounded-2xl px-4 py-3">
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
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white"
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
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Motivo */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Motivo do atendimento *
        </label>
        <input
          type="text"
          placeholder="Ex: consulta de rotina, vacina V10, retorno..."
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white"
        />
      </div>

      {/* Data + hora */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data *</label>
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Horário</label>
          <input
            type="time"
            value={hora}
            onChange={e => setHora(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white"
          />
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observações</label>
        <textarea
          rows={3}
          placeholder="Veterinário/clínica, medicação, preparo, etc."
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}
        className="bg-rose-500 hover:bg-rose-600">
        Salvar agendamento
      </Button>
    </div>
  )
}
