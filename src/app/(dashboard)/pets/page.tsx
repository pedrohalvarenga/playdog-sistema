'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Search, Dog, Plus, ChevronRight } from 'lucide-react'
import { PORTE_LABELS, PLANO_LABELS } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string; telefone: string } }

export default function PetsPage() {
  const [pets, setPets] = useState<PetComTutor[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('pets')
        .select('*, tutor:tutores(nome, telefone)')
        .eq('ativo', true)
        .order('nome')

      if (busca.length >= 2) {
        query = query.ilike('nome', `%${busca}%`)
      }

      const { data } = await query.limit(30)
      setPets((data as PetComTutor[]) ?? [])
      setLoading(false)
    }, busca.length >= 2 ? 300 : 0)
    return () => clearTimeout(timer)
  }, [busca])

  const planoVariant: Record<string, 'purple' | 'orange' | 'teal' | 'gray'> = {
    diaria_avulsa: 'gray',
    pacote_semanal: 'orange',
    pacote_mensal: 'teal',
    hotel: 'purple',
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pets</h1>
        <Link href="/pets/novo">
          <Button size="sm" variant="secondary">
            <Plus size={18} /> Novo
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pets.map(pet => (
            <Link key={pet.id} href={`/pets/${pet.id}`}>
              <Card className="flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pet.foto_url ? (
                    <Image src={pet.foto_url} alt={pet.nome} width={56} height={56} className="object-cover w-full h-full" />
                  ) : (
                    <Dog size={24} className="text-brand-purple" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{pet.nome}</p>
                    <Badge variant="gray">{PORTE_LABELS[pet.porte]}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{pet.tutor.nome}</p>
                  <div className="mt-1">
                    <Badge variant={planoVariant[pet.plano] ?? 'gray'}>{PLANO_LABELS[pet.plano]}</Badge>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </Card>
            </Link>
          ))}

          {pets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Dog size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum pet encontrado</p>
              <Link href="/pets/novo" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
                + Cadastrar primeiro pet
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
