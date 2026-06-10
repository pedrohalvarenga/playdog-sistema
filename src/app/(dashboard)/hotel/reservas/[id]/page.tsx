'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, LogOut, Edit, X, Check, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { STATUS_HOTEL_CORES, STATUS_HOTEL_LABELS, calcNoites, formatCurrencyHotel } from '@/lib/hotel'
import type { Hospedagem } from '@/types/hotel'

export default function ReservaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [h, setH] = useState<Hospedagem | null>(null)
  const [loading, setLoading] = useState(true)
  const [agindo, setAgindo] = useState(false)

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false)
  const [valorTotal, setValorTotal] = useState('')
  const [valorExtras, setValorExtras] = useState('')
  const [extrasDesc, setExtrasDesc] = useState('')
  const [formaPag, setFormaPag] = useState('pix')
  const [savingCheckout, setSavingCheckout] = useState(false)

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('hospedagens')
      .select('*, pet:pets(*, tutor:tutores(nome, telefone, whatsapp))')
      .eq('id', id)
      .single()
    setH(data as Hospedagem)
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Preenche valor sugerido no modal de checkout
  useEffect(() => {
    if (!h || !showCheckout) return
    const noites = calcNoites(
      h.checkin_real ?? h.checkin_previsto,
      h.checkout_previsto
    )
    setValorTotal((noites * h.valor_diaria).toFixed(2).replace('.', ','))
  }, [h, showCheckout])

  async function fazerCheckin() {
    setAgindo(true)
    const supabase = createClient()
    await supabase.from('hospedagens').update({
      status: 'hospedado',
      checkin_real: new Date().toISOString(),
    }).eq('id', id)
    await carregar()
    setAgindo(false)
  }

  async function confirmarCheckout() {
    setSavingCheckout(true)
    const supabase = createClient()
    const total = parseFloat(valorTotal.replace(',', '.')) || 0
    const extras = parseFloat(valorExtras.replace(',', '.')) || 0
    const valorFinal = total + extras

    // Registra hospedagem como finalizada
    await supabase.from('hospedagens').update({
      status: 'finalizada',
      checkout_real: new Date().toISOString(),
      valor_total: valorFinal,
      valor_extras: extras,
      extras_descricao: extrasDesc || null,
    }).eq('id', id)

    // Cria receita no financeiro
    if (valorFinal > 0 && h) {
      const pet = h.pet as NonNullable<Hospedagem['pet']>
      await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: valorFinal,
        area: 'hotel',
        categoria: 'hotel',
        forma_pagamento: formaPag,
        status: 'pago',
        descricao: `Hotel — ${pet?.nome} (${formatDate(h.checkin_previsto, 'dd/MM')} → ${formatDate(h.checkout_previsto, 'dd/MM')})`,
        tutor_id: pet?.tutor_id,
        pet_id: pet?.id,
      })
    }

    setSavingCheckout(false)
    setShowCheckout(false)
    await carregar()
  }

  async function cancelar() {
    if (!motivoCancel.trim()) return
    setAgindo(true)
    const supabase = createClient()
    await supabase.from('hospedagens').update({
      status: 'cancelada',
      motivo_cancelamento: motivoCancel.trim(),
    }).eq('id', id)
    setShowCancel(false)
    setAgindo(false)
    await carregar()
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  if (!h) return <div className="py-6 text-center text-gray-500">Reserva não encontrada.</div>

  const pet = h.pet as NonNullable<Hospedagem['pet']>
  const noites = calcNoites(
    h.checkin_real ?? h.checkin_previsto,
    h.checkout_real ?? h.checkout_previsto
  )
  const valorEstimado = noites * h.valor_diaria

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hotel/reservas" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Reserva</h1>
        </div>
        {h.status !== 'finalizada' && h.status !== 'cancelada' && (
          <Link href={`/hotel/reservas/${id}/editar`} className="p-2 rounded-xl text-gray-400">
            <Edit size={20} />
          </Link>
        )}
      </div>

      {/* Status badge */}
      <div className="flex">
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_HOTEL_CORES[h.status]}`}>
          {STATUS_HOTEL_LABELS[h.status]}
        </span>
      </div>

      {/* Pet info */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl">🐾</div>
          <div>
            <p className="text-xl font-bold text-gray-900">{pet?.nome}</p>
            <p className="text-sm text-gray-500">{pet?.tutor?.nome}</p>
            {pet?.tutor?.telefone && (
              <p className="text-xs text-gray-400">{pet?.tutor?.telefone}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Datas */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogIn size={12} /> Check-in previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkin_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkin_previsto)}</p>
            {h.checkin_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                ✓ Real: {formatDateTime(h.checkin_real)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogOut size={12} /> Check-out previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkout_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkout_previsto)}</p>
            {h.checkout_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                ✓ Real: {formatDateTime(h.checkout_real)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Valor */}
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Diária</p>
            <p className="font-bold text-gray-900">{formatCurrencyHotel(h.valor_diaria)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Noites</p>
            <p className="font-bold text-gray-900">{noites}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{h.valor_total != null ? 'Total pago' : 'Estimado'}</p>
            <p className={`font-bold ${h.valor_total != null ? 'text-brand-purple' : 'text-gray-900'}`}>
              {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
            </p>
          </div>
        </div>
        {h.valor_extras != null && h.valor_extras > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Extras: {formatCurrencyHotel(h.valor_extras)}</p>
            {h.extras_descricao && <p className="text-xs text-gray-500">{h.extras_descricao}</p>}
          </div>
        )}
      </Card>

      {/* Observações */}
      {h.observacoes && (
        <Card>
          <p className="text-xs text-gray-400 mb-1">Observações</p>
          <p className="text-sm text-gray-700">{h.observacoes}</p>
        </Card>
      )}

      {/* Cancelamento */}
      {h.motivo_cancelamento && (
        <Card className="border-l-4 border-red-300">
          <p className="text-xs text-gray-400 mb-1">Motivo do cancelamento</p>
          <p className="text-sm text-gray-700">{h.motivo_cancelamento}</p>
        </Card>
      )}

      {/* Ações */}
      {h.status === 'reservada' && (
        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={fazerCheckin}
            disabled={agindo}
            className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-green-600 disabled:opacity-50"
          >
            <LogIn size={24} />
            {agindo ? 'Registrando...' : 'Fazer Check-in agora'}
          </button>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X size={18} /> Cancelar reserva
          </button>
        </div>
      )}

      {h.status === 'hospedado' && (
        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-4 rounded-2xl bg-brand-orange text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-orange-600"
          >
            <LogOut size={24} />
            Fazer Check-out agora
          </button>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X size={18} /> Cancelar hospedagem
          </button>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Finalizar Check-out</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Valor total (R$) — {noites} noite{noites !== 1 ? 's' : ''} × R$ {h.valor_diaria.toFixed(2).replace('.', ',')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={valorTotal}
                onChange={e => setValorTotal(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Extras (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={valorExtras}
                onChange={e => setValorExtras(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
              />
            </div>

            {parseFloat(valorExtras.replace(',', '.')) > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Descrição dos extras
                </label>
                <input
                  type="text"
                  value={extrasDesc}
                  onChange={e => setExtrasDesc(e.target.value)}
                  placeholder="Banho, medicação..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Forma de pagamento
              </label>
              <select
                value={formaPag}
                onChange={e => setFormaPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500">Total a cobrar</p>
              <p className="text-2xl font-bold text-brand-purple">
                {formatCurrencyHotel(
                  (parseFloat(valorTotal.replace(',', '.')) || 0) +
                  (parseFloat(valorExtras.replace(',', '.')) || 0)
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <Button variant="primary" loading={savingCheckout} onClick={confirmarCheckout}>
                <Check size={18} /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Cancelar reserva</h2>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Motivo *
              </label>
              <textarea
                rows={3}
                value={motivoCancel}
                onChange={e => setMotivoCancel(e.target.value)}
                placeholder="Explique o motivo do cancelamento..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-red-400 outline-none text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={cancelar}
                disabled={!motivoCancel.trim() || agindo}
                className="py-3 rounded-2xl bg-red-500 text-white font-bold disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
