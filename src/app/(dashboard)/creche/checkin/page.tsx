'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Search, Dog, ArrowLeft, CheckCircle } from 'lucide-react'
import { PORTE_LABELS, PLANO_LABELS } from '@/lib/utils'
import Link from 'next/link'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string } }

export default function CheckinPage() {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [pets, setPets] = useState<PetComTutor[]>([])
  const [loading, setLoading] = useState(false)
  const [fazendoCheckin, setFazendoCheckin] = useState<string | null>(null)
  const [hoje] = useState(() => new Date().toISOString().split('T')[0])
  const [jaNaCreche, setJaNaCreche] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function carregarPresentes() {
      const supabase = createClient()
      const { data } = await supabase
        .from('presencas')
        .select('pet_id')
        .eq('data', hoje)
        .is('checkout_at', null)
      setJaNaCreche(new Set(data?.map(p => p.pet_id) ?? []))
    }
    carregarPresentes()
  }, [])

  useEffect(() => {
    if (busca.length < 2) { setPets([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      // Busca por nome do pet
      const { data: porNome } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome)')
        .eq('ativo', true)
        .ilike('nome', `%${busca}%`)
        .limit(10)

      // Busca tutores cujo nome bate, depois traz os pets deles
      const { data: tutoresBusca } = await supabase
        .from('tutores')
        .select('id')
        .ilike('nome', `%${busca}%`)
        .limit(20)

      const idsTutores = tutoresBusca?.map(t => t.id) ?? []
      const { data: porTutor } = idsTutores.length > 0
        ? await supabase
            .from('pets')
            .select('*, tutor:tutores(nome)')
            .eq('ativo', true)
            .in('tutor_id', idsTutores)
            .limit(10)
        : { data: [] as typeof porNome }

      // Mescla sem duplicatas
      const todos = [...(porNome ?? []), ...(porTutor ?? [])]
      const unicos = todos.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
      const data = unicos.slice(0, 15)
      setPets((data as PetComTutor[]) ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  async function fazerCheckin(petId: string) {
    setFazendoCheckin(petId)
    const supabase = createClient()
    await supabase.from('presencas').insert({
      pet_id: petId,
      data: hoje,
      checkin_at: new Date().toISOString(),
    })
    router.push('/creche')
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Check-in — Chamada</h1>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          placeholder="Buscar pet pelo nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <span className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {pets.map(pet => {
          const presente = jaNaCreche.has(pet.id)
          return (
            <Card key={pet.id}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Dog size={22} className="text-brand-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{pet.nome}</p>
                  <p className="text-sm text-gray-500">{pet.tutor.nome}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="gray">{PORTE_LABELS[pet.porte]}</Badge>
                    <Badge variant="purple">{PLANO_LABELS[pet.plano]}</Badge>
                  </div>
                </div>
                {presente ? (
                  <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                    <CheckCircle size={18} />
                    <span>Na creche</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => fazerCheckin(pet.id)}
                    loading={fazendoCheckin === pet.id}
                  >
                    Check-in
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {busca.length >= 2 && pets.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhum pet encontrado para &quot;{busca}&quot;</p>
          <Link href="/pets/novo" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
            + Cadastrar novo pet
          </Link>
        </div>
      )}

      {busca.length < 2 && (
        <p className="text-center text-sm text-gray-400 mt-4">
          Digite pelo menos 2 letras para buscar
        </p>
      )}
    </div>
  )
}
