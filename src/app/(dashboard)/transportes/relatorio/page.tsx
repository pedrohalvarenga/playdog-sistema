'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { formatKm } from '@/lib/transporte'
import type { Transporte } from '@/types/transporte'

// Relatório mensal por tutor: transportes usados e km estimado.
// Base para a futura cobrança por distância/uso — hoje os clientes têm
// pacote fechado, então NADA é cobrado automaticamente.

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface LinhaTutor {
  tutor: string
  pets: Set<string>
  idas: number
  voltas: number
  km: number
  semKm: number
}

export default function RelatorioTransportePage() {
  const [mes, setMes] = useState(mesAtual())
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [loading, setLoading] = useState(true)

  const inicio = `${mes}-01`
  const fimDate = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0)
  const fim = `${mes}-${String(fimDate.getDate()).padStart(2, '0')}`

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('transportes')
      .select('*, pet:pets(id, nome, identificador, tutor_id, tutor:tutores(nome))')
      .eq('status', 'concluido')
      .eq('meio', 'playdog')
      .gte('data', inicio)
      .lte('data', fim)
    setTransportes((data as Transporte[]) ?? [])
    setLoading(false)
  }, [inicio, fim])

  useEffect(() => { carregar() }, [carregar])

  function navMes(delta: number) {
    const d = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)) - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Agrupa por tutor
  const porTutor = new Map<string, LinhaTutor>()
  for (const t of transportes) {
    const nomeTutor = t.pet?.tutor?.nome ?? 'Sem tutor'
    if (!porTutor.has(nomeTutor)) {
      porTutor.set(nomeTutor, { tutor: nomeTutor, pets: new Set(), idas: 0, voltas: 0, km: 0, semKm: 0 })
    }
    const linha = porTutor.get(nomeTutor)!
    linha.pets.add(t.pet?.nome ?? '')
    if (t.tipo === 'buscar') linha.idas++
    else linha.voltas++
    if (t.distancia_km != null) linha.km += Number(t.distancia_km)
    else linha.semKm++
  }
  const linhas = [...porTutor.values()].sort((a, b) => (b.idas + b.voltas) - (a.idas + a.voltas))

  const totalTrechos = transportes.length
  const totalKm = linhas.reduce((acc, l) => acc + l.km, 0)

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/transportes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transportes por Tutor</h1>
          <p className="text-xs text-gray-400">Base para precificação futura — sem cobrança automática</p>
        </div>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center justify-between">
        <button onClick={() => navMes(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-800 capitalize">{formatDate(mes + '-15T12:00:00', 'MMMM yyyy')}</p>
        <button onClick={() => navMes(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : linhas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum transporte concluído neste mês</p>
        </div>
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-brand-purple text-white rounded-2xl p-4">
              <p className="text-2xl font-bold">{totalTrechos}</p>
              <p className="text-xs opacity-80">trechos no mês</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-bold text-gray-900">{formatKm(totalKm)}</p>
              <p className="text-xs text-gray-400">km estimado total</p>
            </div>
          </div>

          {/* Por tutor */}
          <div className="flex flex-col gap-2">
            {linhas.map(l => (
              <div key={l.tutor} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">{l.tutor}</p>
                  <p className="text-sm font-bold text-brand-purple">{l.idas + l.voltas} trecho{l.idas + l.voltas !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{[...l.pets].join(', ')}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>↓ {l.idas} ida{l.idas !== 1 ? 's' : ''}</span>
                  <span>↑ {l.voltas} volta{l.voltas !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-gray-700">{formatKm(l.km)} estimados</span>
                  {l.semKm > 0 && <span className="text-orange-400">({l.semKm} sem km)</span>}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center px-4">
            Km estimado pela distância Play Dog → endereço de cada parada (Google Maps).
            Trechos &quot;sem km&quot; foram feitos antes da chave do Maps estar configurada.
          </p>
        </>
      )}
    </div>
  )
}
