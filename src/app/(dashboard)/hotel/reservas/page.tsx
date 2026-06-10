'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Filter } from 'lucide-react'
import Card from '@/components/ui/Card'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'
import { STATUS_HOTEL_CORES, STATUS_HOTEL_LABELS } from '@/lib/hotel'
import type { Hospedagem, StatusHospedagem } from '@/types/hotel'

const FILTROS: { label: string; value: StatusHospedagem | 'ativas' }[] = [
  { label: 'Ativas', value: 'ativas' },
  { label: 'Reservadas', value: 'reservada' },
  { label: 'Hospedados', value: 'hospedado' },
  { label: 'Finalizadas', value: 'finalizada' },
  { label: 'Canceladas', value: 'cancelada' },
]

export default function ReservasPage() {
  const [hospedagens, setHospedagens] = useState<Hospedagem[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<StatusHospedagem | 'ativas'>('ativas')
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('hospedagens')
      .select('*, pet:pets(*, tutor:tutores(nome))')
      .order('checkin_previsto', { ascending: false })
      .limit(200)

    if (filtro === 'ativas') {
      q = q.in('status', ['reservada', 'hospedado'])
    } else {
      q = q.eq('status', filtro)
    }

    const { data } = await q
    setHospedagens((data as Hospedagem[]) ?? [])
    setLoading(false)
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  const lower = busca.toLowerCase()
  const filtradas = hospedagens.filter(h => {
    const pet = h.pet as NonNullable<Hospedagem['pet']>
    return (
      !busca ||
      pet?.nome?.toLowerCase().includes(lower) ||
      (pet as { identificador?: string })?.identificador?.toLowerCase().includes(lower) ||
      pet?.tutor?.nome?.toLowerCase().includes(lower)
    )
  })

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <Link
          href="/hotel/reservas/nova"
          className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold"
        >
          <Plus size={18} /> Nova
        </Link>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar pet ou tutor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filtro === f.value
                ? 'bg-brand-purple text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Filter size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma reserva encontrada</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtradas.map(h => {
            const pet = h.pet as NonNullable<Hospedagem['pet']>
            return (
              <Link key={h.id} href={`/hotel/reservas/${h.id}`}>
                <Card className="active:scale-98 transition-transform">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🐾</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{pet?.nome}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_HOTEL_CORES[h.status]}`}>
                          {STATUS_HOTEL_LABELS[h.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{pet?.tutor?.nome}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(h.checkin_previsto, 'dd/MM/yyyy')} {formatTime(h.checkin_previsto)}
                        {' → '}
                        {formatDate(h.checkout_previsto, 'dd/MM/yyyy')} {formatTime(h.checkout_previsto)}
                      </p>
                      {h.observacoes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate italic">{h.observacoes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">R$ {h.valor_diaria.toFixed(2).replace('.', ',')}</p>
                      <p className="text-[10px] text-gray-400">/noite</p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
