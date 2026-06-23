'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Search, Dog, Plus, ChevronRight, X, MessageCircle } from 'lucide-react'
import { PORTE_LABELS, whatsappUrl } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string; telefone: string } }

const POR_PAGINA = 40

// Remove acentos para busca e agrupamento ("Ângelo" entra no A)
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function PetsPage() {
  const [pets, setPets] = useState<PetComTutor[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [visiveis, setVisiveis] = useState(POR_PAGINA)

  // Carrega todos os pets ativos uma vez; busca e ordenação são locais (instantâneas)
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pets')
      .select('*, tutor:tutores(nome, telefone)')
      .eq('ativo', true)
      .then(({ data }) => {
        const lista = (data as PetComTutor[]) ?? []
        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
        setPets(lista)
        setLoading(false)
      })
  }, [])

  // Filtro local: busca por nome do pet, tutor ou "como identificamos"
  const filtrados = useMemo(() => {
    if (busca.trim().length < 2) return pets
    const termo = normalizar(busca.trim())
    return pets.filter(p =>
      normalizar(p.nome).includes(termo) ||
      normalizar(p.tutor?.nome ?? '').includes(termo) ||
      normalizar((p as Pet & { identificador?: string | null }).identificador ?? '').includes(termo)
    )
  }, [pets, busca])

  // Reset da paginação quando a busca muda
  useEffect(() => { setVisiveis(POR_PAGINA) }, [busca])

  const mostrados = filtrados.slice(0, visiveis)
  const restantes = filtrados.length - mostrados.length

  // Agrupa por letra inicial (sem acento)
  const grupos = useMemo(() => {
    const mapa = new Map<string, PetComTutor[]>()
    for (const p of mostrados) {
      const letra = normalizar(p.nome.charAt(0)).toUpperCase()
      const chave = /[A-Z]/.test(letra) ? letra : '#'
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave)!.push(p)
    }
    return Array.from(mapa.entries())
  }, [mostrados])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Pets</h1>
          {!loading && (
            <span className="text-sm font-semibold text-gray-400">
              {busca.trim().length >= 2 ? `${filtrados.length} de ${pets.length}` : pets.length}
            </span>
          )}
        </div>
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
          placeholder="Buscar por pet, tutor ou identificação..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-100 text-gray-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {grupos.map(([letra, petsDaLetra]) => (
            <div key={letra} className="flex flex-col gap-2">
              <div className="sticky top-14 z-10 -mx-4 px-4 py-1 bg-gray-50/95 backdrop-blur-sm">
                <span className="text-xs font-bold text-brand-purple tracking-widest">{letra}</span>
              </div>
              {petsDaLetra.map(pet => (
                <Card key={pet.id} className="flex items-center gap-3 hover:shadow-md transition-shadow">
                  <Link href={`/pets/${pet.id}`} className="flex items-center gap-3 flex-1 min-w-0">
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
                      <p className="text-sm text-gray-500 truncate">{pet.tutor?.nome}</p>
                      {(pet as Pet & { identificador?: string | null }).identificador && (
                        <p className="text-xs text-gray-400 truncate">
                          {(pet as Pet & { identificador?: string | null }).identificador}
                        </p>
                      )}
                    </div>
                  </Link>
                  {pet.tutor?.telefone ? (
                    <a
                      href={whatsappUrl(pet.tutor.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 text-green-600 flex-shrink-0 active:scale-95"
                      aria-label={`WhatsApp de ${pet.tutor?.nome ?? 'tutor'}`}
                    >
                      <MessageCircle size={18} />
                    </a>
                  ) : (
                    <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                  )}
                </Card>
              ))}
            </div>
          ))}

          {restantes > 0 && (
            <button
              type="button"
              onClick={() => setVisiveis(v => v + POR_PAGINA)}
              className="mt-2 py-3 rounded-2xl border-2 border-brand-purple/30 text-brand-purple font-semibold text-sm bg-white hover:bg-purple-50 transition-colors"
            >
              Ver mais {Math.min(restantes, POR_PAGINA)} {restantes === 1 ? 'cão' : 'cães'} ({restantes} restante{restantes === 1 ? '' : 's'})
            </button>
          )}

          {filtrados.length === 0 && (
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
