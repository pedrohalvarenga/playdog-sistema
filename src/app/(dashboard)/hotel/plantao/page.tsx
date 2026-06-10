'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Moon, Users, AlertTriangle, Check } from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import type { Plantonista, EscalaPlantao, Hospedagem } from '@/types/hotel'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function PlantaoPage() {
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const [plantonistas, setPlantonistas] = useState<Plantonista[]>([])
  const [escalas, setEscalas] = useState<Record<string, EscalaPlantao>>({})
  const [hospedagens, setHospedagens] = useState<Hospedagem[]>([])
  const [loading, setLoading] = useState(true)
  const [escalando, setEscalando] = useState<string | null>(null)

  const hoje = new Date().toISOString().split('T')[0]

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const inicio = new Date(mes.ano, mes.mes, 1).toISOString().split('T')[0]
    const fim = new Date(mes.ano, mes.mes + 1, 0).toISOString().split('T')[0]

    const [{ data: plan }, { data: esc }, { data: hosp }] = await Promise.all([
      supabase.from('plantonistas').select('*').eq('ativo', true).order('nome'),
      supabase.from('escala_plantao').select('*, plantonista:plantonistas(nome, valor_noite)')
        .gte('data', inicio).lte('data', fim),
      supabase.from('hospedagens')
        .select('checkin_previsto, checkout_previsto')
        .not('status', 'in', '(cancelada)')
        .lte('checkin_previsto', fim + 'T23:59:59')
        .gte('checkout_previsto', inicio + 'T00:00:00'),
    ])

    setPlantonistas((plan as Plantonista[]) ?? [])
    const escMap: Record<string, EscalaPlantao> = {}
    ;((esc as EscalaPlantao[]) ?? []).forEach(e => { escMap[e.data] = e })
    setEscalas(escMap)
    setHospedagens((hosp as Hospedagem[]) ?? [])
    setLoading(false)
  }, [mes])

  useEffect(() => { carregar() }, [carregar])

  function hospedadosNaNoite(data: string): number {
    return hospedagens.filter(h => {
      const ci = new Date(h.checkin_previsto).toISOString().split('T')[0]
      const co = new Date(h.checkout_previsto).toISOString().split('T')[0]
      return ci <= data && co > data
    }).length
  }

  async function escalar(data: string, plantonista_id: string) {
    setEscalando(data)
    const supabase = createClient()
    const plantonista = plantonistas.find(p => p.id === plantonista_id)

    const existing = escalas[data]
    if (existing) {
      await supabase.from('escala_plantao').update({
        plantonista_id,
        valor_noite: plantonista?.valor_noite ?? 0,
      }).eq('id', existing.id)
    } else {
      await supabase.from('escala_plantao').insert({
        data,
        plantonista_id,
        valor_noite: plantonista?.valor_noite ?? 0,
      })
    }
    await carregar()
    setEscalando(null)
  }

  // Dias do mês
  const primeiroDia = new Date(mes.ano, mes.mes, 1)
  const ultimoDia = new Date(mes.ano, mes.mes + 1, 0)
  const dias: string[] = []
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    dias.push(`${mes.ano}-${String(mes.mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  function prevMes() { setMes(m => m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ano: m.ano, mes: m.mes - 1 }) }
  function nextMes() { setMes(m => m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ano: m.ano, mes: m.mes + 1 }) }

  const alertas = dias.filter(d => hospedadosNaNoite(d) > 0 && !escalas[d]?.plantonista_id)

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Plantão</h1>
        <div className="flex gap-2">
          <Link href="/hotel/plantao/plantonistas" className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold">
            <Users size={16} /> Plantonistas
          </Link>
        </div>
      </div>

      {/* Alerta sem plantonistas */}
      {alertas.length > 0 && (
        <div className="bg-red-50 rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-600">
            {alertas.length} noite{alertas.length > 1 ? 's' : ''} com cães hospedados sem plantonista escalado.
          </p>
        </div>
      )}

      {/* Navegação mensal */}
      <div className="flex items-center justify-between">
        <button onClick={prevMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-900">{MESES[mes.mes]} {mes.ano}</p>
        <button onClick={nextMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : plantonistas.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-4">
            Nenhum plantonista cadastrado.{' '}
            <Link href="/hotel/plantao/plantonistas/novo" className="text-brand-purple font-semibold">Cadastrar</Link>
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {dias.map(data => {
            const qtd = hospedadosNaNoite(data)
            const escala = escalas[data]
            const plantonista = escala?.plantonista as { nome?: string; valor_noite?: number } | undefined
            const semPlantonista = qtd > 0 && !plantonista
            const d = new Date(data + 'T12:00:00')
            const isHoje = data === hoje

            return (
              <Card key={data} className={semPlantonista ? 'border-l-4 border-red-400' : ''}>
                <div className="flex items-center gap-3">
                  {/* Data */}
                  <div className={`w-12 text-center rounded-xl py-1.5 flex-shrink-0 ${isHoje ? 'bg-brand-purple' : 'bg-gray-100'}`}>
                    <p className={`text-[10px] font-semibold ${isHoje ? 'text-white/70' : 'text-gray-400'}`}>
                      {DIAS_SEMANA[d.getDay()]}
                    </p>
                    <p className={`text-xl font-bold leading-none ${isHoje ? 'text-white' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Quantidade de cães */}
                    <div className="flex items-center gap-2 mb-1">
                      <Moon size={14} className="text-indigo-400" />
                      <span className="text-xs text-gray-500">{qtd} cã{qtd !== 1 ? 'es' : 'o'} hospedado{qtd !== 1 ? 's' : ''}</span>
                      {semPlantonista && <AlertTriangle size={14} className="text-red-400" />}
                    </div>

                    {/* Select plantonista */}
                    {qtd > 0 || plantonista ? (
                      <select
                        value={escala?.plantonista_id ?? ''}
                        onChange={e => escalar(data, e.target.value)}
                        disabled={escalando === data}
                        className="w-full text-sm px-3 py-1.5 rounded-xl border border-gray-200 bg-white focus:border-brand-purple outline-none"
                      >
                        <option value="">— Selecionar plantonista —</option>
                        {plantonistas.map(p => (
                          <option key={p.id} value={p.id}>{p.nome} (R$ {p.valor_noite.toFixed(2).replace('.', ',')})</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-300">Sem hospedagens</p>
                    )}
                  </div>

                  {escala?.plantonista_id && (
                    <Check size={18} className="text-green-500 flex-shrink-0" />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Link pagamentos */}
      <Link
        href="/hotel/plantao/pagamentos"
        className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 rounded-2xl py-3 font-semibold text-sm"
      >
        <Moon size={18} /> Ver pagamentos de plantonistas
      </Link>
    </div>
  )
}
