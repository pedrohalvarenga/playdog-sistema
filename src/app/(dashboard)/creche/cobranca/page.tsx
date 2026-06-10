'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { ArrowLeft, AlertCircle, CreditCard, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Pet, Tutor } from '@/types'

type PetNegativo = Pet & { tutor: Tutor }

interface Devedor {
  tutor: Tutor
  pets: PetNegativo[]
  totalDiarias: number
  valorEstimado: number
}

export default function CobrancaPage() {
  const [devedores, setDevedores] = useState<Devedor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: pets }, { data: precos }] = await Promise.all([
        supabase
          .from('pets')
          .select('*, tutor:tutores(*)')
          .eq('ativo', true)
          .lt('saldo_diarias', 0)
          .order('saldo_diarias'),
        supabase.from('precos_padrao').select('*'),
      ])

      if (!pets) { setDevedores([]); setLoading(false); return }

      const precoPadrao = precos?.find(p => p.plano === 'diaria_avulsa')?.valor ?? 0

      // Agrupa por tutor
      const mapa = new Map<string, Devedor>()
      for (const pet of pets as PetNegativo[]) {
        const tutorId = pet.tutor_id
        if (!mapa.has(tutorId)) {
          mapa.set(tutorId, { tutor: pet.tutor, pets: [], totalDiarias: 0, valorEstimado: 0 })
        }
        const entrada = mapa.get(tutorId)!
        const diariasDevidas = Math.abs(pet.saldo_diarias)
        const precoPet = (pet.tutor as Tutor).preco_personalizado ?? precoPadrao
        entrada.pets.push(pet)
        entrada.totalDiarias += diariasDevidas
        entrada.valorEstimado += diariasDevidas * precoPet
      }

      // Ordena por maior devedor (valor estimado)
      const lista = Array.from(mapa.values()).sort((a, b) => b.valorEstimado - a.valorEstimado)
      setDevedores(lista)
      setLoading(false)
    }
    load()
  }, [])

  const totalGeral = devedores.reduce((s, d) => s + d.valorEstimado, 0)

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel de Cobrança</h1>
          <p className="text-sm text-gray-400">Tutores com saldo negativo</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : devedores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum tutor com saldo negativo</p>
          <p className="text-sm">Todos os pets estão em dia!</p>
        </div>
      ) : (
        <>
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-semibold">{devedores.length} tutor{devedores.length !== 1 ? 'es' : ''} negativos</p>
              <p className="text-xs text-red-500">Total estimado a cobrar</p>
            </div>
            <p className="text-xl font-bold text-red-600">
              {totalGeral > 0 ? `R$ ${totalGeral.toFixed(2).replace('.', ',')}` : '—'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {devedores.map(d => (
              <Card key={d.tutor.id} className="border-l-4 border-red-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{d.tutor.nome}</p>
                    <p className="text-sm text-gray-500">{d.tutor.telefone}</p>
                    <div className="mt-2 flex flex-col gap-1">
                      {d.pets.map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                          <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                          <span className="text-gray-700 font-medium">{p.nome}</span>
                          {p.identificador && <span className="text-gray-400 text-xs">({p.identificador})</span>}
                          <span className="text-red-500 font-semibold">{p.saldo_diarias}d</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-xl font-semibold">
                        {d.totalDiarias} diária{d.totalDiarias !== 1 ? 's' : ''} devida{d.totalDiarias !== 1 ? 's' : ''}
                      </span>
                      {d.valorEstimado > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-xl font-semibold">
                          ≈ R$ {d.valorEstimado.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {d.pets[0] && (
                      <Link
                        href={`/creche/comprar-diarias/${d.pets[0].id}`}
                        className="flex items-center gap-1 bg-brand-purple text-white text-xs px-3 py-2 rounded-xl font-semibold"
                      >
                        <CreditCard size={13} />
                        Comprar
                      </Link>
                    )}
                    <Link
                      href={`/creche/extrato/${d.tutor.id}`}
                      className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-3 py-2 rounded-xl font-semibold"
                    >
                      <FileText size={13} />
                      Extrato
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
