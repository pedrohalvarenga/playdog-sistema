'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Car, MapPin, Phone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_TRANSP_LABELS, STATUS_TRANSP_CORES, proximoStatusTransporte, formatHora } from '@/lib/banho_tosa'
import type { Transporte, StatusTransporte } from '@/types/banho_tosa'

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TransportesPage() {
  const hoje = toLocalDate(new Date())
  const [data, setData] = useState(hoje)
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [loading, setLoading] = useState(true)
  const [avancando, setAvancando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('transportes')
      .select('*, pet:pets(id, nome, identificador, foto_url, tutor_id, tutor:tutores(nome, telefone, whatsapp))')
      .eq('data', data)
      .not('status', 'eq', 'cancelado')
      .order('horario')
    setTransportes((rows as Transporte[]) ?? [])
    setLoading(false)
  }, [data])

  useEffect(() => { carregar() }, [carregar])

  async function avancar(id: string, novoStatus: StatusTransporte) {
    setAvancando(id)
    const supabase = createClient()
    await supabase.from('transportes').update({ status: novoStatus }).eq('id', id)
    await carregar()
    setAvancando(null)
  }

  const navData = (delta: number) => {
    const d = new Date(data + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setData(toLocalDate(d))
  }

  const pendentes   = transportes.filter(t => t.status === 'pendente')
  const emRota      = transportes.filter(t => t.status === 'em_rota')
  const concluidos  = transportes.filter(t => t.status === 'concluido')

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transportes do Dia</h1>
        <p className="text-sm text-gray-400">Corridas agendadas · Banho &amp; Tosa</p>
      </div>

      {/* Navegação dia */}
      <div className="flex items-center justify-between">
        <button onClick={() => navData(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-800">
          {data === hoje ? 'Hoje' : formatDate(data + 'T12:00:00', "EEE, dd 'de' MMMM")}
        </p>
        <button onClick={() => navData(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : transportes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma corrida para este dia</p>
        </div>
      ) : (
        <>
          {/* Contadores */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-orange-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-brand-orange">{pendentes.length}</p>
              <p className="text-[10px] text-orange-400">Pendente{pendentes.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{emRota.length}</p>
              <p className="text-[10px] text-blue-400">Em rota</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{concluidos.length}</p>
              <p className="text-[10px] text-green-400">Concluído{concluidos.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-3">
            {transportes.map(t => {
              const pet = t.pet!
              const tutor = pet.tutor
              const proximo = proximoStatusTransporte(t.status)

              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    {/* Pet */}
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {pet.foto_url ? (
                        <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
                      ) : <span className="text-xl">🐾</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">
                          {pet.nome}
                          {pet.identificador && (
                            <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>
                          )}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TRANSP_CORES[t.status]}`}>
                          {STATUS_TRANSP_LABELS[t.status]}
                        </span>
                      </div>

                      {/* Horário + tipo */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{formatHora(t.horario)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.tipo === 'buscar' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {t.tipo === 'buscar' ? '↓ Buscar' : '↑ Levar'}
                        </span>
                      </div>

                      {/* Endereço */}
                      <div className="flex items-start gap-1 mt-2">
                        <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-600">{t.endereco}</p>
                      </div>

                      {/* Tutor e telefone */}
                      {tutor && (
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span>{tutor.nome}</span>
                          {(tutor.whatsapp || tutor.telefone) && (
                            <a
                              href={`tel:${tutor.whatsapp || tutor.telefone}`}
                              className="flex items-center gap-1 text-brand-teal font-semibold"
                              onClick={e => e.stopPropagation()}
                            >
                              <Phone size={11} />
                              {tutor.whatsapp || tutor.telefone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão de avançar */}
                  {proximo && (
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => avancar(t.id, proximo)}
                        disabled={avancando === t.id}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                          proximo === 'concluido'
                            ? 'bg-green-500 text-white'
                            : 'bg-brand-orange text-white'
                        }`}
                      >
                        {avancando === t.id ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          `→ ${STATUS_TRANSP_LABELS[proximo]}`
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
