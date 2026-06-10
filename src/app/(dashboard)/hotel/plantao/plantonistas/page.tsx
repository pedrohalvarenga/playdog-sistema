'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Phone } from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import type { Plantonista } from '@/types/hotel'

export default function PlantonistasPage() {
  const [plantonistas, setPlantonistas] = useState<Plantonista[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('plantonistas')
      .select('*')
      .order('nome')
    setPlantonistas((data as Plantonista[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Plantonistas</h1>
        <Link
          href="/hotel/plantao/plantonistas/novo"
          className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold"
        >
          <Plus size={18} /> Novo
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : plantonistas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Nenhum plantonista cadastrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {plantonistas.map(p => (
            <Link key={p.id} href={`/hotel/plantao/plantonistas/${p.id}/editar`}>
              <Card className="active:scale-98 transition-transform">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🌙</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{p.nome}</p>
                      {!p.ativo && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    {p.telefone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={11} /> {p.telefone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600">R$ {p.valor_noite.toFixed(2).replace('.', ',')}</p>
                    <p className="text-[10px] text-gray-400">/noite</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
