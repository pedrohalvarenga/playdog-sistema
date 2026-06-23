'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, LogOut, Edit, X, Check, Moon, DollarSign, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SelectExecutadoPor from '@/components/funcionarios/SelectExecutadoPor'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { STATUS_HOTEL_CORES, STATUS_HOTEL_LABELS, calcNoites, formatCurrencyHotel } from '@/lib/hotel'
import type { Hospedagem } from '@/types/hotel'
import { hojeLocal } from '@/lib/datas'

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
  const [execPor, setExecPor] = useState('')
  const [savingCheckout, setSavingCheckout] = useState(false)
  // status do pagamento no checkout (se ainda pendente)
  const [checkoutStatusPag, setCheckoutStatusPag] = useState<'pago' | 'pendente'>('pago')

  // Modal registrar pagamento (disponível em qualquer status)
  const [showPagamento, setShowPagamento] = useState(false)
  const [pagFormaPag, setPagFormaPag] = useState('pix')
  const [pagData, setPagData] = useState('')
  const [pagValor, setPagValor] = useState('')
  const [savingPag, setSavingPag] = useState(false)

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  // Outras hospedagens do mesmo grupo
  const [grupo, setGrupo] = useState<Hospedagem[]>([])

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('hospedagens')
      .select('*, pet:pets(*, tutor:tutores(nome, telefone, whatsapp))')
      .eq('id', id)
      .single()
    setH(data as Hospedagem)
    const hosp = data as Hospedagem
    if (hosp?.grupo_id) {
      const { data: doGrupo } = await supabase
        .from('hospedagens')
        .select('*, pet:pets(*, tutor:tutores(nome, telefone, whatsapp))')
        .eq('grupo_id', hosp.grupo_id)
        .neq('id', id)
      setGrupo((doGrupo as Hospedagem[]) ?? [])
    } else {
      setGrupo([])
    }
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
    const pacoteProprio = h.valor_pacote != null && h.valor_pacote > 0
      ? h.valor_pacote
      : noites * h.valor_diaria
    // Mesmo conjunto que entra no rateio do checkout (exclui finalizada/cancelada)
    const pacoteGrupo = grupo
      .filter(g => g.status === 'hospedado' || g.status === 'reservada')
      .reduce((s, g) => s + (g.valor_pacote ?? 0), 0)
    setValorTotal((pacoteProprio + pacoteGrupo).toFixed(2))
  }, [h, grupo, showCheckout])

  // Preenche valor no modal de pagamento
  useEffect(() => {
    if (!h || !showPagamento) return
    const noites = calcNoites(h.checkin_previsto, h.checkout_previsto)
    const v = h.valor_total ?? h.valor_pacote ?? (noites * h.valor_diaria)
    setPagValor(v.toFixed(2))
    setPagData(hojeLocal())
  }, [h, showPagamento])

  async function fazerCheckin() {
    setAgindo(true)
    const supabase = createClient()
    const payload = { status: 'hospedado', checkin_real: new Date().toISOString() }
    const q = h?.grupo_id
      ? supabase.from('hospedagens').update(payload).eq('grupo_id', h.grupo_id).eq('status', 'reservada')
      : supabase.from('hospedagens').update(payload).eq('id', id)
    const { error } = await q
    if (error) alert(`Erro ao fazer check-in: ${error.message}`)
    await carregar()
    setAgindo(false)
  }

  async function registrarPagamento() {
    if (!h) return
    setSavingPag(true)
    const supabase = createClient()
    const valor = parseFloat(pagValor.replace(',', '.')) || 0
    const pet = h.pet as NonNullable<Hospedagem['pet']>
    const periodo = `${formatDate(h.checkin_previsto, 'dd/MM')} → ${formatDate(h.checkout_previsto, 'dd/MM')}`

    const { data: recData, error: errRec } = await supabase.from('receitas').insert({
      data: pagData || hojeLocal(),
      valor,
      area: 'hotel',
      categoria: 'hotel',
      forma_pagamento: pagFormaPag,
      status: 'pago',
      descricao: `Hotel — ${pet?.nome} (${periodo})`,
      tutor_id: pet?.tutor_id,
      pet_id: pet?.id,
    }).select('id').single()

    if (errRec) {
      alert(`Erro ao lançar receita: ${errRec.message}`)
      setSavingPag(false)
      return
    }

    await supabase.from('hospedagens').update({
      status_pagamento: 'pago',
      receita_id: recData?.id ?? null,
    }).eq('id', id)

    setSavingPag(false)
    setShowPagamento(false)
    await carregar()
  }

  async function confirmarCheckout() {
    if (!h) return
    setSavingCheckout(true)
    const supabase = createClient()
    const total = parseFloat(valorTotal.replace(',', '.')) || 0
    const extras = parseFloat(valorExtras.replace(',', '.')) || 0
    const valorFinal = total + extras
    const agora = new Date().toISOString()
    const hoje = hojeLocal()
    const periodo = `${formatDate(h.checkin_previsto, 'dd/MM')} → ${formatDate(h.checkout_previsto, 'dd/MM')}`

    const membros: Hospedagem[] = [h, ...grupo.filter(g => g.status === 'hospedado' || g.status === 'reservada')]
    const n = membros.length
    const cota = Math.floor((valorFinal / n) * 100) / 100
    const ultimaCota = Math.round((valorFinal - cota * (n - 1)) * 100) / 100

    for (let i = 0; i < membros.length; i++) {
      const m = membros[i]
      const valorPet = i === n - 1 ? ultimaCota : cota

      const { error: errHosp } = await supabase.from('hospedagens').update({
        status: 'finalizada',
        // Garante coerência: irmão 'reservada' que sai junto recebe o check-in real
        checkin_real: m.checkin_real ?? agora,
        checkout_real: agora,
        valor_total: valorPet,
        valor_extras: i === 0 ? extras : 0,
        extras_descricao: i === 0 ? (extrasDesc || null) : null,
        status_pagamento: m.status_pagamento === 'pago' ? 'pago' : checkoutStatusPag,
      }).eq('id', m.id)

      if (errHosp) {
        alert(`Erro ao finalizar a hospedagem de ${(m.pet as NonNullable<Hospedagem['pet']>)?.nome}: ${errHosp.message}.`)
        setSavingCheckout(false)
        await carregar()
        return
      }

      // Se já pago anteriormente: só atualiza o valor na receita existente
      if (m.status_pagamento === 'pago' && m.receita_id) {
        await supabase.from('receitas').update({ valor: valorPet }).eq('id', m.receita_id)
        continue
      }

      // Se não pago: cria receita agora com o status escolhido no checkout
      if (valorPet > 0) {
        const pet = m.pet as NonNullable<Hospedagem['pet']>
        const { data: recData, error: errRec } = await supabase.from('receitas').insert({
          data: hoje,
          valor: valorPet,
          area: 'hotel',
          categoria: 'hotel',
          forma_pagamento: formaPag,
          status: checkoutStatusPag,
          descricao: `Hotel — ${pet?.nome} (${periodo})${n > 1 ? ` · rateio ${i + 1}/${n}` : ''}`,
          tutor_id: pet?.tutor_id,
          pet_id: pet?.id,
          executado_por: execPor || null,
        }).select('id').single()
        if (errRec) {
          alert(`Hospedagem finalizada, mas erro ao lançar receita de ${pet?.nome}: ${errRec.message}. Lance manualmente no financeiro.`)
        } else if (recData?.id) {
          await supabase.from('hospedagens').update({ receita_id: recData.id }).eq('id', m.id)
        }
      }
    }

    setSavingCheckout(false)
    setShowCheckout(false)
    await carregar()
  }

  async function reabrirHospedagem() {
    if (!window.confirm('Reabrir esta hospedagem? O checkout será desfeito e o pet voltará para "hospedado". Se houver receita lançada no financeiro, ela permanecerá e precisará ser removida manualmente.')) return
    setAgindo(true)
    const supabase = createClient()
    const { error } = await supabase.from('hospedagens').update({
      status: 'hospedado',
      checkout_real: null,
      valor_total: null,
      valor_extras: null,
      extras_descricao: null,
      status_pagamento: 'pendente',
      receita_id: null,
    }).eq('id', id)
    if (error) alert(`Erro ao reabrir: ${error.message}`)
    setAgindo(false)
    await carregar()
  }

  async function cancelar() {
    if (!motivoCancel.trim()) return
    setAgindo(true)
    const supabase = createClient()
    const payload = { status: 'cancelada', motivo_cancelamento: motivoCancel.trim() }
    const membrosAtivos = grupo.filter(g => g.status === 'reservada' || g.status === 'hospedado')
    let q
    if (h?.grupo_id && membrosAtivos.length > 0 &&
        window.confirm(`Esta reserva faz parte de um grupo com mais ${membrosAtivos.length} cão(es). Cancelar o grupo todo?\n\nOK = cancela todos · Cancelar = só este cão`)) {
      q = supabase.from('hospedagens').update(payload)
        .eq('grupo_id', h.grupo_id).in('status', ['reservada', 'hospedado'])
    } else {
      q = supabase.from('hospedagens').update(payload).eq('id', id)
    }
    const { error } = await q
    if (error) alert(`Erro ao cancelar: ${error.message}`)
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
  const valorEstimado = h.valor_pacote != null && h.valor_pacote > 0
    ? h.valor_pacote
    : noites * h.valor_diaria
  const diariaEquivalente = noites > 0 ? valorEstimado / noites : h.valor_diaria
  const jaPago = h.status_pagamento === 'pago'

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
        {h.status !== 'cancelada' && (
          <Link href={`/hotel/reservas/${id}/editar`} className="p-2 rounded-xl text-gray-400">
            <Edit size={20} />
          </Link>
        )}
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_HOTEL_CORES[h.status]}`}>
          {STATUS_HOTEL_LABELS[h.status]}
        </span>
        {h.status !== 'cancelada' && (
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${jaPago ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {jaPago ? '✓ Pago' : '⏳ Pendente'}
          </span>
        )}
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

      {/* Grupo */}
      {grupo.length > 0 && (
        <Card className="border-l-4 border-brand-orange">
          <p className="text-xs text-gray-400 mb-2">Hospedagem em grupo — mesmo tutor</p>
          <div className="flex flex-col gap-2">
            {grupo.map(g => (
              <Link key={g.id} href={`/hotel/reservas/${g.id}`} className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">🐾 {(g.pet as NonNullable<Hospedagem['pet']>)?.nome}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_HOTEL_CORES[g.status]}`}>
                  {STATUS_HOTEL_LABELS[g.status]}
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Check-in, check-out e pagamento valem para o grupo todo, com rateio automático por cão.
          </p>
        </Card>
      )}

      {/* Datas */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogIn size={12} /> Check-in previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkin_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkin_previsto)}</p>
            {h.checkin_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">✓ Real: {formatDateTime(h.checkin_real)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogOut size={12} /> Check-out previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkout_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkout_previsto)}</p>
            {h.checkout_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">✓ Real: {formatDateTime(h.checkout_real)}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Valor */}
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">{h.valor_total != null ? 'Total' : 'Pacote'}</p>
            <p className={`font-bold ${h.valor_total != null ? 'text-brand-purple' : 'text-gray-900'}`}>
              {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Noites</p>
            <p className="font-bold text-gray-900">{noites}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Diária equiv.</p>
            <p className="font-bold text-gray-900">{formatCurrencyHotel(diariaEquivalente)}</p>
          </div>
        </div>
        {h.valor_extras != null && h.valor_extras > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Extras: {formatCurrencyHotel(h.valor_extras)}</p>
            {h.extras_descricao && <p className="text-xs text-gray-500">{h.extras_descricao}</p>}
          </div>
        )}
      </Card>

      {/* Card de pagamento — aparece em todos os status exceto cancelada */}
      {h.status !== 'cancelada' && (
        <Card className={jaPago ? 'border-l-4 border-green-400' : 'border-l-4 border-orange-400'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${jaPago ? 'bg-green-100' : 'bg-orange-100'}`}>
                <DollarSign size={20} className={jaPago ? 'text-green-600' : 'text-orange-600'} />
              </div>
              <div>
                <p className={`font-bold text-sm ${jaPago ? 'text-green-700' : 'text-orange-700'}`}>
                  {jaPago ? 'Pagamento recebido' : 'Pagamento pendente'}
                </p>
                <p className="text-xs text-gray-500">
                  {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
                </p>
              </div>
            </div>
            {!jaPago && (
              <button
                onClick={() => setShowPagamento(true)}
                className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-semibold"
              >
                Receber
              </button>
            )}
          </div>
        </Card>
      )}

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
          <Link
            href={`/hotel/reservas/${id}/editar`}
            className="w-full py-3 rounded-2xl border-2 border-brand-purple/30 text-brand-purple font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Edit size={18} /> Editar datas, horários e valor
          </Link>
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
          <Link
            href={`/hotel/reservas/${id}/editar`}
            className="w-full py-3 rounded-2xl border-2 border-brand-purple/30 text-brand-purple font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Edit size={18} /> Editar datas, horários e valor
          </Link>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X size={18} /> Cancelar hospedagem
          </button>
        </div>
      )}

      {h.status === 'finalizada' && (
        <div className="flex flex-col gap-3 mt-2">
          <Link
            href={`/hotel/reservas/${id}/editar`}
            className="w-full py-3 rounded-2xl border-2 border-brand-purple/30 text-brand-purple font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Edit size={18} /> Editar datas, horários e valor
          </Link>
          <button
            onClick={reabrirHospedagem}
            disabled={agindo}
            className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw size={18} /> Reabrir hospedagem (desfazer checkout)
          </button>
        </div>
      )}

      {/* Modal Registrar Pagamento */}
      {showPagamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Registrar pagamento</h2>
            <p className="text-sm text-gray-500 -mt-2">{pet?.nome} · {pet?.tutor?.nome}</p>

            <div className="bg-purple-50 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Valor a receber</span>
              <span className="font-bold text-brand-purple">{formatCurrencyHotel(parseFloat(pagValor) || 0)}</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                value={pagValor}
                onChange={e => setPagValor(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Forma de pagamento</label>
              <select
                value={pagFormaPag}
                onChange={e => setPagFormaPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data do recebimento</label>
              <input
                type="date"
                value={pagData}
                onChange={e => setPagData(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowPagamento(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <Button variant="primary" loading={savingPag} onClick={registrarPagamento}>
                <Check size={18} /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Finalizar Check-out</h2>

            {grupo.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-orange-800 font-semibold">
                  Check-out em grupo ({grupo.filter(g => g.status === 'hospedado' || g.status === 'reservada').length + 1} cães)
                </p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Informe o valor total — será dividido automaticamente entre os cães.
                </p>
              </div>
            )}

            {jaPago ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Check size={20} className="text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800 font-semibold">Pagamento já registrado — o caixa não será afetado novamente.</p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Status do pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCheckoutStatusPag('pago')}
                    className={`py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 border-2 transition-colors ${checkoutStatusPag === 'pago' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 text-gray-500'}`}
                  >
                    <Check size={16} /> Pago agora
                  </button>
                  <button
                    onClick={() => setCheckoutStatusPag('pendente')}
                    className={`py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 border-2 transition-colors ${checkoutStatusPag === 'pendente' ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500'}`}
                  >
                    ⏳ Pendente
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Valor da hospedagem (R$) — pacote de {noites} noite{noites !== 1 ? 's' : ''}
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Extras (R$)</label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Descrição dos extras</label>
                <input
                  type="text"
                  value={extrasDesc}
                  onChange={e => setExtrasDesc(e.target.value)}
                  placeholder="Banho, medicação..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
                />
              </div>
            )}

            {!jaPago && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Forma de pagamento</label>
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
            )}

            <SelectExecutadoPor value={execPor} onChange={setExecPor} label="Quem atendeu (comissão)" />

            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500">Total</p>
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Motivo *</label>
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
