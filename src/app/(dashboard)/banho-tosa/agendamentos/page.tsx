'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Car, Scissors } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { STATUS_BT_LABELS, STATUS_BT_CORES, formatHora } from '@/lib/banho_tosa'
import { useProfile } from '@/hooks/useProfile'
import type { AgendamentoBanhoTosa, StatusAgendamento } from '@/types/banho_tosa'

const STATUS_FILTROS: { valor: StatusAgendamento | 'todos'; label: string }[] = [
  { valor: 'todos',          label: 'Todos' },
  { valor: 'agendado',       label: 'Agendado' },
  { valor: 'em_atendimento', label: 'Em atend.' },
  { valor: 'pronto',         label: 'Pronto' },
  { valor: 'entregue',       label: 'Entregue' },
  { valor: 'cancelado',      label: 'Cancelado' },
]

export default function AgendamentosListPage() {
  const { profile } = useProfile()
  const [agendamentos, setAgendamentos] = useState<AgendamentoBanhoTosa[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | 'todos'>('todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('agendamentos_banho_tosa')
      .select('*, pet:pets(id, nome, identificador, foto_url, tutor_id, tutor:tutores(nome))')
      .order('data', { ascending: false })
      .order('hora_chegada', { ascending: true })
      .limit(200)

    if (filtroStatus !== 'todos') query = query.eq('status', filtroStatus)

    const { data } = await query
    setAgendamentos((data as AgendamentoBanhoTosa[]) ?? [])
    setLoading(false)
  }, [filtroStatus])

  useEffect(() => { carregar() }, [carregar])

  const podeNovo = profile?.role === 'admin' || profile?.role === 'recepcao'

  const filtrados = agendamentos.filter(ag => {
    if (!busca) return true
    const termo = busca.toLowerCase()
    const pet = ag.pet
    return (
      pet?.nome.toLowerCase().includes(termo) ||
      pet?.identificador?.toLowerCase().includes(termo) ||
      pet?.tutor?.nome.toLowerCase().includes(termo) ||
      ag.descricao_servico.toLowerCase().includes(termo)
    )
  })

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
        {podeNovo && (
          <Link
            href="/banho-tosa/agendamentos/novo"
            className="flex items-center gap-1.5 bg-brand-teal text-white px-4 py-2 rounded-2xl text-sm font-semibold"
          >
            <Plus size={18} /> Novo
          </Link>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Buscar pet, tutor ou serviço..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTROS.map(f => (
          <button
            key={f.valor}
            onClick={() => setFiltroStatus(f.valor)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtroStatus === f.valor
                ? 'bg-brand-teal text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Scissors size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum agendamento encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(ag => {
            const pet = ag.pet!
            return (
              <Link key={ag.id} href={`/banho-tosa/agendamentos/${ag.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 active:bg-gray-50">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {pet.foto_url ? (
                      <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
                    ) : <span className="text-lg">🐾</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900">
                        {pet.nome}
                        {pet.identificador && <span className="text-gray-400 font-normal ml-1 text-sm">({pet.identificador})</span>}
                      </p>
                      {ag.taxi_dog && <Car size={13} className="text-brand-orange" />}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{ag.descricao_servico}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(ag.data + 'T12:00:00', 'dd/MM/yyyy')} · {formatHora(ag.hora_chegada)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BT_CORES[ag.status]}`}>
                    {STATUS_BT_LABELS[ag.status]}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
