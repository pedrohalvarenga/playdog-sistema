'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Moon, LogIn, LogOut, Plus, AlertTriangle, Calendar, Settings } from 'lucide-react'
import Card from '@/components/ui/Card'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'
import { STATUS_HOTEL_CORES, STATUS_HOTEL_LABELS } from '@/lib/hotel'
import type { Hospedagem, EscalaPlantao } from '@/types/hotel'

export default function HotelPage() {
  const [hospedados, setHospedados] = useState<Hospedagem[]>([])
  const [checkins, setCheckins] = useState<Hospedagem[]>([])
  const [checkouts, setCheckouts] = useState<Hospedagem[]>([])
  const [escala, setEscala] = useState<EscalaPlantao | null>(null)
  const [loading, setLoading] = useState(true)

  const hoje = new Date().toISOString().split('T')[0]

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const amanhaDStr = amanha.toISOString().split('T')[0]

    const [{ data: hosp }, { data: esc }] = await Promise.all([
      supabase
        .from('hospedagens')
        .select('*, pet:pets(*, tutor:tutores(nome, telefone))')
        .in('status', ['reservada', 'hospedado'])
        .order('checkin_previsto'),
      supabase
        .from('escala_plantao')
        .select('*, plantonista:plantonistas(*)')
        .eq('data', hoje)
        .single(),
    ])

    const lista = (hosp as Hospedagem[]) ?? []

    // Hospedados agora (status=hospedado ou reservada com check-in real)
    const agora = lista.filter(h => h.status === 'hospedado')

    // Entradas previstas/realizadas hoje
    const entradas = lista.filter(h => {
      const dt = new Date(h.checkin_previsto).toISOString().split('T')[0]
      return dt === hoje
    })

    // Saídas previstas hoje
    const saidas = lista.filter(h => {
      const dt = new Date(h.checkout_previsto).toISOString().split('T')[0]
      return dt === hoje || dt === amanhaDStr
    })

    setHospedados(agora)
    setCheckins(entradas)
    setCheckouts(saidas)
    setEscala(esc as EscalaPlantao | null)
    setLoading(false)
  }, [hoje])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotel</h1>
          <p className="text-sm text-gray-400">{formatDate(hoje, "dd 'de' MMMM, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hotel/config" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <Settings size={20} />
          </Link>
          <Link
            href="/hotel/reservas/nova"
            className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold active:bg-purple-700"
          >
            <Plus size={18} />
            Nova reserva
          </Link>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-brand-purple rounded-2xl p-3 text-white text-center">
          <p className="text-2xl font-bold">{hospedados.length}</p>
          <p className="text-xs opacity-80">Hospedados</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{checkins.length}</p>
          <p className="text-xs text-blue-400">Entradas hoje</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-brand-orange">{checkouts.length}</p>
          <p className="text-xs text-orange-400">Saídas hoje</p>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/hotel/reservas" className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-98">
          <Calendar size={22} className="text-brand-purple" />
          <span className="font-semibold text-gray-800 text-sm">Reservas</span>
        </Link>
        <Link href="/hotel/agenda" className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-98">
          <Moon size={22} className="text-brand-teal" />
          <span className="font-semibold text-gray-800 text-sm">Agenda</span>
        </Link>
      </div>

      {/* Plantonista da noite */}
      <Card className={!escala?.plantonista && hospedados.length > 0 ? 'border-l-4 border-red-400' : ''}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Moon size={20} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Plantonista desta noite</p>
            {escala?.plantonista ? (
              <>
                <p className="font-bold text-gray-900">{escala.plantonista.nome}</p>
                {escala.plantonista.telefone && (
                  <p className="text-xs text-gray-500">{escala.plantonista.telefone}</p>
                )}
              </>
            ) : (
              <p className={`font-semibold ${hospedados.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {hospedados.length > 0 ? '⚠️ Ninguém escalado!' : 'Ninguém escalado'}
              </p>
            )}
          </div>
          <Link href="/hotel/plantao" className="text-xs text-brand-purple font-semibold">Escalar</Link>
        </div>
      </Card>

      {/* Hospedados agora */}
      {hospedados.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Hospedados agora</h2>
          <div className="flex flex-col gap-2">
            {hospedados.map(h => (
              <HospedagemCard key={h.id} hospedagem={h} />
            ))}
          </div>
        </section>
      )}

      {/* Entradas de hoje */}
      {checkins.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <LogIn size={13} className="text-blue-500" /> Entradas previstas hoje
          </h2>
          <div className="flex flex-col gap-2">
            {checkins.map(h => (
              <HospedagemCard key={h.id} hospedagem={h} />
            ))}
          </div>
        </section>
      )}

      {/* Saídas de hoje */}
      {checkouts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <LogOut size={13} className="text-orange-500" /> Saídas previstas hoje
          </h2>
          <div className="flex flex-col gap-2">
            {checkouts.map(h => (
              <HospedagemCard key={h.id} hospedagem={h} />
            ))}
          </div>
        </section>
      )}

      {hospedados.length === 0 && checkins.length === 0 && checkouts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Moon size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma hospedagem hoje</p>
          <Link href="/hotel/reservas/nova" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
            Criar reserva
          </Link>
        </div>
      )}
    </div>
  )
}

function HospedagemCard({ hospedagem: h }: { hospedagem: Hospedagem }) {
  const pet = h.pet as NonNullable<Hospedagem['pet']>
  return (
    <Link href={`/hotel/reservas/${h.id}`}>
      <Card className="active:scale-98 transition-transform">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🐾</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 truncate">{pet?.nome ?? '—'}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_HOTEL_CORES[h.status]}`}>
                {STATUS_HOTEL_LABELS[h.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{pet?.tutor?.nome}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(h.checkin_previsto, 'dd/MM')} → {formatDate(h.checkout_previsto, 'dd/MM')}
              {' · '}
              {formatTime(h.checkin_previsto)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-gray-800">
              R$ {h.valor_diaria.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-[10px] text-gray-400">/noite</p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
