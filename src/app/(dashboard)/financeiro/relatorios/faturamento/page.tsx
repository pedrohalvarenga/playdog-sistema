'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, Dog, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/financeiro'
import { CATEGORIA_RECEITA_LABELS, AREA_LABELS } from '@/lib/financeiro'
import type { CategoriaReceita, AreaNegocio } from '@/types/financeiro'
import { formatDate } from '@/lib/utils'

type Aba = 'pet' | 'tutor'

interface Lancamento {
  id: string
  data: string
  valor: number
  valor_liquido: number | null
  categoria: CategoriaReceita
  area: AreaNegocio
  descricao: string | null
  forma_pagamento: string
}

interface GrupoItem {
  id: string | null
  nome: string
  total: number
  lancamentos: Lancamento[]
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function FaturamentoPorPage() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [aba, setAba] = useState<Aba>('pet')
  const [grupos, setGrupos] = useState<GrupoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)

  const navMes = (dir: number) => {
    const d = new Date(ano, mes + dir, 1)
    setMes(d.getMonth())
    setAno(d.getFullYear())
  }

  const buscar = useCallback(async () => {
    setLoading(true)
    setAberto(null)
    const supabase = createClient()
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    const fim = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('receitas')
      .select(`
        id, data, valor, valor_liquido, categoria, area, descricao, forma_pagamento,
        pet:pets(id, nome),
        tutor:tutores(id, nome)
      `)
      .gte('data', inicio)
      .lte('data', fim)
      .eq('status', 'pago')
      .order('data', { ascending: false })

    if (!data) { setGrupos([]); setLoading(false); return }

    // Agrupar
    const map = new Map<string, GrupoItem>()

    for (const r of data as any[]) {
      const entidade = aba === 'pet' ? r.pet : r.tutor
      const key = entidade?.id ?? '__sem__'
      const nome = entidade?.nome ?? (aba === 'pet' ? 'Sem pet vinculado' : 'Sem tutor vinculado')
      const valor = r.valor_liquido ?? r.valor

      if (!map.has(key)) {
        map.set(key, { id: key === '__sem__' ? null : key, nome, total: 0, lancamentos: [] })
      }
      const g = map.get(key)!
      g.total += valor
      g.lancamentos.push({
        id: r.id, data: r.data, valor: r.valor, valor_liquido: r.valor_liquido,
        categoria: r.categoria, area: r.area, descricao: r.descricao,
        forma_pagamento: r.forma_pagamento,
      })
    }

    const lista = Array.from(map.values()).sort((a, b) => b.total - a.total)
    setGrupos(lista)
    setLoading(false)
  }, [mes, ano, aba])

  useEffect(() => { buscar() }, [buscar])

  const total = grupos.reduce((s, g) => s + g.total, 0)

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Faturamento</h1>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-4 py-3">
        <button onClick={() => navMes(-1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-gray-800 capitalize">
          {MESES[mes]} {ano}
        </span>
        <button onClick={() => navMes(1)} className="p-1 rounded-xl text-gray-400 hover:text-gray-700">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAba('pet')}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
            aba === 'pet' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <Dog size={16} /> Por Pet
        </button>
        <button
          onClick={() => setAba('tutor')}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
            aba === 'tutor' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <Users size={16} /> Por Tutor
        </button>
      </div>

      {/* Total do período */}
      {!loading && (
        <div className="bg-gradient-to-r from-brand-purple to-purple-600 rounded-2xl px-5 py-4 text-white">
          <p className="text-sm opacity-80">Total — {MESES[mes]} {ano}</p>
          <p className="text-3xl font-bold mt-0.5">{formatCurrency(total)}</p>
          <p className="text-xs opacity-70 mt-1">{grupos.length} {aba === 'pet' ? 'pets' : 'tutores'} · {grupos.reduce((s, g) => s + g.lancamentos.length, 0)} lançamentos</p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nenhum lançamento pago neste período.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {grupos.map((g, idx) => {
            const key = g.id ?? '__sem__'
            const isOpen = aberto === key
            const pct = total > 0 ? (g.total / total) * 100 : 0
            const isNenhum = !g.id

            return (
              <div key={key} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  onClick={() => setAberto(isOpen ? null : key)}
                >
                  {/* Ranking */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isNenhum ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                      {g.nome}
                    </p>
                    {/* Barra de progresso */}
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-purple rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{pct.toFixed(1)}% do total · {g.lancamentos.length} lançto{g.lancamentos.length !== 1 ? 's' : ''}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600">{formatCurrency(g.total)}</p>
                    {isOpen ? <ChevronUp size={14} className="text-gray-400 ml-auto mt-0.5" /> : <ChevronDown size={14} className="text-gray-400 ml-auto mt-0.5" />}
                  </div>
                </button>

                {/* Detalhes */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {g.lancamentos.map(l => (
                      <Link
                        key={l.id}
                        href={`/financeiro/receitas/${l.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {l.descricao || CATEGORIA_RECEITA_LABELS[l.categoria]}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(l.data)} · {AREA_LABELS[l.area]}
                          </p>
                        </div>
                        <p className="font-semibold text-sm text-green-600 flex-shrink-0">
                          +{formatCurrency(l.valor_liquido ?? l.valor)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
