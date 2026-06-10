'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Car, Clock, Check, X, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import {
  STATUS_BT_LABELS, STATUS_BT_CORES,
  proximoStatusBT, formatHora, formatCurrencyBT,
} from '@/lib/banho_tosa'
import { useProfile } from '@/hooks/useProfile'
import type { AgendamentoBanhoTosa, StatusAgendamento } from '@/types/banho_tosa'

export default function AgendamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { profile } = useProfile()
  const [ag, setAg] = useState<AgendamentoBanhoTosa | null>(null)
  const [loading, setLoading] = useState(true)
  const [agindo, setAgindo] = useState(false)

  // Modal pagamento
  const [showPag, setShowPag] = useState(false)
  const [valorServico, setValorServico] = useState('')
  const [valorTaxi, setValorTaxi] = useState('')
  const [formaPag, setFormaPag] = useState('pix')
  const [statusPag, setStatusPag] = useState<'pago' | 'pendente'>('pago')
  const [salvandoPag, setSalvandoPag] = useState(false)

  // Modal cancelamento
  const [showCancel, setShowCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const podePagar   = profile?.role === 'admin' || profile?.role === 'recepcao'
  const podeEditar  = podePagar
  const podeAvancar = profile?.role !== 'motorista'

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('agendamentos_banho_tosa')
      .select('*, pet:pets(id, nome, identificador, foto_url, porte, tutor_id, tutor:tutores(nome, telefone, whatsapp, endereco))')
      .eq('id', id)
      .single()
    setAg(data as AgendamentoBanhoTosa)
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!ag || !showPag) return
    setValorServico(ag.valor_servico != null ? ag.valor_servico.toFixed(2).replace('.', ',') : '')
    setValorTaxi(ag.valor_taxi != null ? ag.valor_taxi.toFixed(2).replace('.', ',') : '')
  }, [ag, showPag])

  async function avancar(novoStatus: StatusAgendamento) {
    if (!ag) return
    setAgindo(true)
    const supabase = createClient()
    const extra: Record<string, unknown> = {}
    if (novoStatus === 'em_atendimento') extra.hora_chegada_real = new Date().toISOString()
    await supabase.from('agendamentos_banho_tosa').update({ status: novoStatus, ...extra }).eq('id', id)
    await carregar()
    setAgindo(false)
  }

  async function confirmarEntrega() {
    if (!ag) return
    setSalvandoPag(true)
    const supabase = createClient()
    const pet = ag.pet!
    const vServico = parseFloat(valorServico.replace(',', '.')) || 0
    const vTaxi    = parseFloat(valorTaxi.replace(',', '.')) || 0
    const updates: Record<string, unknown> = {
      status: 'entregue',
      hora_saida_real: new Date().toISOString(),
    }

    if (vServico > 0) {
      const { data: r1 } = await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: vServico,
        area: 'banho_tosa',
        categoria: 'banho_tosa',
        forma_pagamento: formaPag,
        status: statusPag,
        descricao: `Banho & Tosa — ${pet.nome}${pet.identificador ? ` (${pet.identificador})` : ''}: ${ag.descricao_servico}`,
        tutor_id: pet.tutor_id,
        pet_id: pet.id,
      }).select('id').single()
      if (r1) updates.receita_servico_id = r1.id
    }

    if (ag.taxi_dog && vTaxi > 0) {
      const { data: r2 } = await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: vTaxi,
        area: 'transporte',
        categoria: 'transporte',
        forma_pagamento: formaPag,
        status: statusPag,
        descricao: `Taxi Dog — ${pet.nome}${pet.identificador ? ` (${pet.identificador})` : ''} (${ag.taxi_tipo})`,
        tutor_id: pet.tutor_id,
        pet_id: pet.id,
      }).select('id').single()
      if (r2) updates.receita_taxi_id = r2.id
    }

    await supabase.from('agendamentos_banho_tosa').update(updates).eq('id', id)
    setSalvandoPag(false)
    setShowPag(false)
    await carregar()
  }

  async function cancelar() {
    if (!ag || !motivoCancel.trim()) return
    setAgindo(true)
    const supabase = createClient()
    await supabase.from('agendamentos_banho_tosa')
      .update({ status: 'cancelado', motivo_cancelamento: motivoCancel.trim() })
      .eq('id', id)
    await supabase.from('transportes').update({ status: 'cancelado' }).eq('origem_id', id)
    setShowCancel(false)
    setAgindo(false)
    router.push('/banho-tosa')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
    </div>
  )
  if (!ag) return <div className="py-6 text-center text-gray-500">Agendamento não encontrado.</div>

  const pet = ag.pet!
  const proximo = proximoStatusBT(ag.status)
  const isFinal = ag.status === 'entregue' || ag.status === 'cancelado'

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/banho-tosa" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Agendamento</h1>
        {podeEditar && ag.status === 'agendado' && (
          <Link href={`/banho-tosa/agendamentos/${id}/editar`} className="p-2 rounded-xl text-gray-400">
            <Edit size={20} />
          </Link>
        )}
        <Link href={`/banho-tosa/historico/${pet.id}`} className="p-2 rounded-xl text-gray-400">
          <History size={20} />
        </Link>
      </div>

      {/* Status */}
      <div className="flex">
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_BT_CORES[ag.status]}`}>
          {STATUS_BT_LABELS[ag.status]}
        </span>
      </div>

      {/* Pet */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
            {pet.foto_url ? (
              <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
            ) : '🐾'}
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {pet.nome}
              {pet.identificador && <span className="text-gray-400 font-normal ml-1 text-base">({pet.identificador})</span>}
            </p>
            <p className="text-sm text-gray-500">{pet.tutor?.nome}</p>
            {pet.tutor?.telefone && <p className="text-xs text-gray-400">{pet.tutor.telefone}</p>}
          </div>
        </div>
      </Card>

      {/* Serviço */}
      <Card>
        <p className="text-xs text-gray-400 mb-1">Serviço</p>
        <p className="font-semibold text-gray-800">{ag.descricao_servico}</p>
        {ag.valor_servico != null && (
          <p className="text-brand-teal font-bold mt-1">{formatCurrencyBT(ag.valor_servico)}</p>
        )}
      </Card>

      {/* Horários */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock size={11} /> Data</p>
            <p className="font-semibold text-gray-800">{formatDate(ag.data + 'T12:00:00', 'dd/MM/yyyy')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Chegada</p>
            <p className="font-semibold text-gray-800">{formatHora(ag.hora_chegada)}</p>
            {ag.hora_chegada_real && (
              <p className="text-xs text-green-600 font-semibold">
                ✓ Real: {new Date(ag.hora_chegada_real).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Saída prevista</p>
            <p className="font-semibold text-gray-800">{formatHora(ag.hora_saida_prevista)}</p>
            {ag.hora_saida_real && (
              <p className="text-xs text-green-600 font-semibold">
                ✓ Real: {new Date(ag.hora_saida_real).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Taxi Dog */}
      {ag.taxi_dog && (
        <Card className="border-l-4 border-brand-orange">
          <div className="flex items-center gap-2 mb-2">
            <Car size={18} className="text-brand-orange" />
            <p className="font-semibold text-gray-800">Taxi Dog</p>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {ag.taxi_tipo === 'buscar' ? 'Buscar' : ag.taxi_tipo === 'levar' ? 'Levar' : 'Buscar + Levar'}
            </span>
          </div>
          {ag.taxi_endereco && <p className="text-sm text-gray-600">{ag.taxi_endereco}</p>}
          {ag.valor_taxi != null && (
            <p className="text-sm font-bold text-brand-orange mt-1">{formatCurrencyBT(ag.valor_taxi)}</p>
          )}
        </Card>
      )}

      {/* Observações */}
      {ag.observacoes && (
        <Card>
          <p className="text-xs text-gray-400 mb-1">Observações</p>
          <p className="text-sm text-gray-700">{ag.observacoes}</p>
        </Card>
      )}

      {/* Motivo cancelamento */}
      {ag.motivo_cancelamento && (
        <Card className="border-l-4 border-red-300">
          <p className="text-xs text-gray-400 mb-1">Motivo do cancelamento</p>
          <p className="text-sm text-gray-700">{ag.motivo_cancelamento}</p>
        </Card>
      )}

      {/* Ações */}
      {!isFinal && podeAvancar && proximo && (
        <div className="flex flex-col gap-3 mt-2">
          {proximo === 'entregue' ? (
            podePagar && (
              <button
                onClick={() => setShowPag(true)}
                className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-green-600"
              >
                <Check size={24} /> Registrar entrega e pagamento
              </button>
            )
          ) : (
            <button
              onClick={() => avancar(proximo)}
              disabled={agindo}
              className="w-full py-4 rounded-2xl bg-brand-teal text-white font-bold text-lg flex items-center justify-center gap-3 active:opacity-80 disabled:opacity-50"
            >
              {agindo ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : `→ ${STATUS_BT_LABELS[proximo]}`}
            </button>
          )}

          {podePagar && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <X size={18} /> Cancelar agendamento
            </button>
          )}
        </div>
      )}

      {/* Modal Pagamento */}
      {showPag && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Registrar entrega</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do serviço (R$)</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={valorServico} onChange={e => setValorServico(e.target.value)} placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm"
              />
            </div>

            {ag.taxi_dog && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do Taxi Dog (R$)</label>
                <input
                  type="number" inputMode="decimal" min="0" step="0.01"
                  value={valorTaxi} onChange={e => setValorTaxi(e.target.value)} placeholder="0,00"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Registrado separadamente como receita de transporte</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Forma de pagamento</label>
              <select
                value={formaPag} onChange={e => setFormaPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status do pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                {(['pago', 'pendente'] as const).map(s => (
                  <button key={s} onClick={() => setStatusPag(s)}
                    className={`py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
                      statusPag === s
                        ? s === 'pago' ? 'border-green-500 bg-green-50 text-green-700' : 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {s === 'pago' ? 'Pago' : 'Pendente'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-teal-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-2">Registros que serão criados:</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Banho & Tosa</span>
                <span className="font-bold">{formatCurrencyBT(parseFloat(valorServico.replace(',', '.')) || 0)}</span>
              </div>
              {ag.taxi_dog && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Transporte (Taxi Dog)</span>
                  <span className="font-bold">{formatCurrencyBT(parseFloat(valorTaxi.replace(',', '.')) || 0)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPag(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold">
                Cancelar
              </button>
              <Button variant="primary" loading={salvandoPag} onClick={confirmarEntrega}
                className="bg-green-500 hover:bg-green-600">
                <Check size={18} /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelamento */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Cancelar agendamento</h2>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Motivo *</label>
              <textarea
                rows={3} value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)}
                placeholder="Explique o motivo..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-red-400 outline-none text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowCancel(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold">
                Voltar
              </button>
              <button onClick={cancelar} disabled={!motivoCancel.trim() || agindo}
                className="py-3 rounded-2xl bg-red-500 text-white font-bold disabled:opacity-50">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
