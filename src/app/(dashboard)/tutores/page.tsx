'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Search, Users, Plus, ChevronRight, Dog } from 'lucide-react'
import Link from 'next/link'
import type { Tutor } from '@/types'

type TutorComPets = Tutor & { pets: { id: string; nome: string }[] }

export default function TutoresPage() {
  const [tutores, setTutores] = useState<TutorComPets[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('tutores')
        .select('*, pets(id, nome)')
        .order('nome')

      if (busca.length >= 2) {
        query = query.ilike('nome', `%${busca}%`)
      }

      const { data } = await query.limit(30)
      setTutores((data as TutorComPets[]) ?? [])
      setLoading(false)
    }, busca.length >= 2 ? 300 : 0)
    return () => clearTimeout(timer)
  }, [busca])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tutores</h1>
        <Link href="/tutores/novo">
          <Button size="sm" variant="secondary">
            <Plus size={18} /> Novo
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar tutor..."
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
          {tutores.map(tutor => (
            <Link key={tutor.id} href={`/tutores/${tutor.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Users size={22} className="text-brand-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{tutor.nome}</p>
                    <p className="text-sm text-gray-500">{tutor.telefone}</p>
                    {tutor.pets?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Dog size={12} className="text-brand-purple" />
                        <p className="text-xs text-gray-400">{tutor.pets.map(p => p.nome).join(', ')}</p>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}

          {tutores.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum tutor encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
