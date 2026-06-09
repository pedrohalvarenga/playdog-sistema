'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Tutor, Porte, PlanoTipo } from '@/types'

export default function EditarPetPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingDados, setLoadingDados] = useState(true)
  const [tutores, setTutores] = useState<Tutor[]>([])

  const [tutorId, setTutorId] = useState('')
  const [nomePet, setNomePet] = useState('')
  const [raca, setRaca] = useState('')
  const [porte, setPorte] = useState<Porte>('M')
  const [nascimento, setNascimento] = useState('')
  const [castrado, setCastrado] = useState(false)
  const [restricoes, setRestrioes] = useState('')
  const [plano, setPlano] = useState<PlanoTipo>('diaria_avulsa')
  const [vacinaV8, setVacinaV8] = useState('')
  const [vacinaRaiva, setVacinaRaiva] = useState('')
  const [vacinaGripe, setVacinaGripe] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: pet }, { data: ts }] = await Promise.all([
        supabase.from('pets').select('*').eq('id', id).single(),
        supabase.from('tutores').select('*').order('nome').limit(200),
      ])
      if (pet) {
        setTutorId(pet.tutor_id ?? '')
        setNomePet(pet.nome ?? '')
        setRaca(pet.raca ?? '')
        setPorte(pet.porte ?? 'M')
        setNascimento(pet.data_nascimento ?? '')
        setCastrado(pet.castrado ?? false)
        setRestrioes(pet.restricoes ?? '')
        setPlano(pet.plano ?? 'diaria_avulsa')
        setVacinaV8(pet.vacina_v8_v10 ?? '')
        setVacinaRaiva(pet.vacina_antirabica ?? '')
        setVacinaGripe(pet.vacina_gripe ?? '')
      }
      setTutores(ts ?? [])
      setLoadingDados(false)
    }
    load()
  }, [id])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('pets').update({
      tutor_id: tutorId,
      nome: nomePet,
      raca: raca || null,
      porte,
      data_nascimento: nascimento || null,
      castrado,
      restricoes: restricoes || null,
      plano,
      vacina_v8_v10: vacinaV8 || null,
      vacina_antirabica: vacinaRaiva || null,
      vacina_gripe: vacinaGripe || null,
    }).eq('id', id)

    if (error) { setLoading(false); alert('Erro ao salvar'); return }
    router.push(`/pets/${id}`)
  }

  const porteBtns: Porte[] = ['P', 'M', 'G']
  const planos: { value: PlanoTipo; label: string }[] = [
    { value: 'diaria_avulsa', label: 'Diária Avulsa' },
    { value: 'pacote_semanal', label: 'Pacote Semanal' },
    { value: 'pacote_mensal', label: 'Pacote Mensal' },
    { value: 'hotel', label: 'Hotel' },
  ]

  if (loadingDados) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/pets/${id}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Editar Pet</h1>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-5">
        {/* Tutor */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Tutor</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Selecionar tutor</label>
            <select
              value={tutorId}
              onChange={e => setTutorId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
            >
              <option value="">Escolha o tutor...</option>
              {tutores.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Dados do Pet */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Dados do Pet</h2>

          <Input label="Nome do pet" value={nomePet} onChange={e => setNomePet(e.target.value)} required />
          <Input label="Raça" value={raca} onChange={e => setRaca(e.target.value)} placeholder="Ex: Golden Retriever" />
          <Input label="Data de nascimento" type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Porte</label>
            <div className="flex gap-2">
              {porteBtns.map(p => (
                <button key={p} type="button" onClick={() => setPorte(p)}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${porte === p ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {p === 'P' ? 'Pequeno' : p === 'M' ? 'Médio' : 'Grande'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
            <label className="font-semibold text-gray-700">Castrado</label>
            <button
              type="button"
              onClick={() => setCastrado(!castrado)}
              className={`w-12 h-7 rounded-full transition-all ${castrado ? 'bg-brand-purple' : 'bg-gray-300'} relative`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${castrado ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <Input
            label="Restrições / Comportamento"
            value={restricoes}
            onChange={e => setRestrioes(e.target.value)}
            placeholder="Ex: Agressivo com machos, não come ração X..."
          />
        </section>

        {/* Plano */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Plano contratado</h2>
          <div className="grid grid-cols-2 gap-2">
            {planos.map(p => (
              <button key={p.value} type="button" onClick={() => setPlano(p.value)}
                className={`py-3 px-2 rounded-2xl text-sm font-semibold transition-all ${plano === p.value ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Vacinas */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Vacinas</h2>
          <Input label="V8/V10 — última dose" type="date" value={vacinaV8} onChange={e => setVacinaV8(e.target.value)} />
          <Input label="Antirrábica — última dose" type="date" value={vacinaRaiva} onChange={e => setVacinaRaiva(e.target.value)} />
          <Input label="Gripe — última dose" type="date" value={vacinaGripe} onChange={e => setVacinaGripe(e.target.value)} />
        </section>

        <Button type="submit" size="lg" loading={loading}>
          Salvar Alterações
        </Button>
      </form>
    </div>
  )
}
