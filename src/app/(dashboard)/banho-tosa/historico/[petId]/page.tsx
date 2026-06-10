'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Car, Scissors } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { STATUS_BT_CORES, STATUS_BT_LABELS, formatHora, formatCurrencyBT } from '@/lib/banho_tosa'
import type { AgendamentoBanhoTosa } from '@/types/banho_tosa'

export default function HistoricoPetPage({ params }: { params: Promise<{ petId: string }> }) {
  const { petId } = use(params)
  const [historico, setHistorico] = useState<AgendamentoBanhoTosa[]>([])
  const [petNome, setPetNome] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const [{ data: pet }, { data: ags }] = await Promise.all([
        supabase.from('pets').select('nome, identificador').eq('id', petId).single(),
        supabase
          .from('agendamentos_banho_tosa')
          .select('*')
          .eq('pet_id', petId)
          .order('data', { ascending: false })
          .order('hora_chegada', { ascending: false }),
      ])
      if (pet) {
        const p = pet as { nome: string; identificador?: string }
        setPetNome(p.identificador ? `${p.nome} (${p.identificador})` : p.nome)
      }
      setHistorico((ags as AgendamentoBanhoTosa[]) ?? [])
      setLoading(false)
    }
    carregar()
  }, [petId])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => history.back()} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Histórico de Banho & Tosa</h1>
          {petNome && <p className="text-sm text-gray-400">{petNome}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
        </div>
      ) : historico.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Scissors size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum atendimento registrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {historico.map(ag => (
            <Link key={ag.id} href={`/banho-tosa/agendamentos/${ag.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-800">{formatDate(ag.data + 'T12:00:00', 'dd/MM/yyyy')}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BT_CORES[ag.status]}`}>
                    {STATUS_BT_LABELS[ag.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{ag.descricao_servico}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{formatHora(ag.hora_chegada)}{ag.hora_saida_prevista ? ` → ${formatHora(ag.hora_saida_prevista)}` : ''}</span>
                  {ag.valor_servico != null && (
                    <span className="font-semibold text-gray-600">{formatCurrencyBT(ag.valor_servico)}</span>
                  )}
                  {ag.taxi_dog && <span className="flex items-center gap-0.5 text-brand-orange"><Car size={11} /> Taxi</span>}
                </div>
                {ag.observacoes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{ag.observacoes}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
