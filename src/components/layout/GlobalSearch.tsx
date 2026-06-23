'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Dog, User } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PetRes { id: string; nome: string; identificador: string | null; tutor: { nome: string } | null }
interface TutorRes { id: string; nome: string; telefone: string | null }

export default function GlobalSearch() {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [pets, setPets] = useState<PetRes[]>([])
  const [tutores, setTutores] = useState<TutorRes[]>([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (aberto) inputRef.current?.focus() }, [aberto])

  useEffect(() => {
    const t = termo.trim().toLowerCase().replace(/[%,()]/g, ' ').trim()
    if (t.length < 2) { setPets([]); setTutores([]); return }
    setBuscando(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const [{ data: ps }, { data: ts }] = await Promise.all([
        supabase.from('pets').select('id, nome, identificador, tutor:tutores(nome)')
          .eq('ativo', true).or(`nome.ilike.%${t}%,identificador.ilike.%${t}%`).limit(6),
        supabase.from('tutores').select('id, nome, telefone').ilike('nome', `%${t}%`).limit(6),
      ])
      setPets((ps as unknown as PetRes[]) ?? [])
      setTutores((ts as TutorRes[]) ?? [])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [termo])

  function fechar() { setAberto(false); setTermo(''); setPets([]); setTutores([]) }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="p-2 rounded-xl text-gray-400 hover:text-brand-purple hover:bg-purple-50"
        aria-label="Buscar pet ou tutor"
      >
        <Search size={20} />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={fechar}>
          <div className="bg-white max-w-lg mx-auto mt-0 p-4 safe-top" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={termo}
                onChange={e => setTermo(e.target.value)}
                placeholder="Buscar pet ou tutor..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              />
              <button onClick={fechar} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 max-h-[60vh] overflow-y-auto flex flex-col gap-1">
              {buscando && <p className="text-xs text-gray-400 text-center py-2">Buscando...</p>}
              {pets.map(p => (
                <Link key={`p-${p.id}`} href={`/pets/${p.id}`} onClick={fechar}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50">
                  <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><Dog size={16} className="text-brand-purple" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.nome}
                      {p.identificador && <span className="text-gray-400 font-normal ml-1">({p.identificador})</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{p.tutor?.nome}</p>
                  </div>
                </Link>
              ))}
              {tutores.map(t => (
                <Link key={`t-${t.id}`} href={`/tutores/${t.id}`} onClick={fechar}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50">
                  <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0"><User size={16} className="text-brand-orange" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.nome}</p>
                    <p className="text-xs text-gray-400 truncate">Tutor{t.telefone ? ` · ${t.telefone}` : ''}</p>
                  </div>
                </Link>
              ))}
              {!buscando && termo.trim().length >= 2 && pets.length === 0 && tutores.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nada encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
