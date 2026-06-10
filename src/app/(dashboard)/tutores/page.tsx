'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Search, Users, Plus, ChevronRight, Dog, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { whatsappUrl } from '@/lib/utils'
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
        .eq('ativo', true)
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
            <Card key={tutor.id}>
              <div className="flex items-center gap-3">
                <Link href={`/tutores/${tutor.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Users size={22} className="text-brand-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{tutor.nome}</p>
                    <p className="text-sm text-gray-500">{tutor.telefone}</p>
                    {tutor.pets?.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Dog size={11} className="text-brand-purple flex-shrink-0" />
                        <p className="text-xs text-gray-400 truncate">{tutor.pets.map(p => p.nome).join(', ')}</p>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {tutor.telefone && (
                    <a
                      href={whatsappUrl(tutor.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 active:bg-green-200 transition-colors"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}
                  <Link href={`/tutores/${tutor.id}`} className="text-gray-300">
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </Card>
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
