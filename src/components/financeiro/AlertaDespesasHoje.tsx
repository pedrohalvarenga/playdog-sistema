'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/financeiro'
import { formatDate } from '@/lib/utils'

interface DespesaPend {
  id: string
  descricao: string | null
  categoria: string
  valor: number
  data_vencimento: string
}

export default function AlertaDespesasHoje() {
  const [despesas, setDespesas] = useState<DespesaPend[]>([])
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
    const chave = `alerta-despesas-${hoje}`
    if (sessionStorage.getItem(chave)) return

    const supabase = createClient()
    supabase
      .from('despesas')
      .select('id, descricao, categoria, valor, data_vencimento')
      .eq('status', 'pendente')
      .lte('data_vencimento', hoje)
      .order('data_vencimento')
      .then(({ data }) => {
        // RLS: usuários não-admin não enxergam despesas — lista vem vazia e nada aparece
        if (data && data.length > 0) {
          setDespesas(data as DespesaPend[])
          setAberto(true)
          sessionStorage.setItem(chave, '1')
        }
      })
  }, [])

  if (!aberto || despesas.length === 0) return null

  const total = despesas.reduce((s, d) => s + d.valor, 0)
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setAberto(false)}>
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Despesas a pagar</h2>
              <p className="text-xs text-gray-400">{despesas.length} pendência{despesas.length > 1 ? 's' : ''} até hoje</p>
            </div>
          </div>
          <button onClick={() => setAberto(false)} className="p-1.5 rounded-xl text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {despesas.slice(0, 6).map(d => {
            const vencida = d.data_vencimento < hoje
            return (
              <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{d.descricao || d.categoria}</p>
                  <p className={`text-xs ${vencida ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {vencida ? `Vencida — ${formatDate(d.data_vencimento)}` : 'Vence hoje'}
                  </p>
                </div>
                <p className="font-bold text-sm text-red-600 flex-shrink-0 ml-2">{formatCurrency(d.valor)}</p>
              </div>
            )
          })}
          {despesas.length > 6 && (
            <p className="text-xs text-gray-400 text-center">+ {despesas.length - 6} outras pendências</p>
          )}
        </div>

        <div className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
          <p className="text-sm font-semibold text-red-700">Total</p>
          <p className="font-bold text-red-700">{formatCurrency(total)}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setAberto(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-semibold text-sm">
            Depois
          </button>
          <Link
            href="/financeiro/pendencias"
            onClick={() => setAberto(false)}
            className="flex-1 py-3 rounded-2xl bg-brand-purple text-white font-bold text-sm text-center"
          >
            Ver pendências
          </Link>
        </div>
      </div>
    </div>
  )
}
