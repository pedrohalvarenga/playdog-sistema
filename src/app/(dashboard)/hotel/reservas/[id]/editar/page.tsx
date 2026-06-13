'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { calcNoites } from '@/lib/hotel'
import type { Hospedagem } from '@/types/hotel'

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditarReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [h, setH] = useState<Hospedagem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const [checkinPrevisto, setCheckinPrevisto] = useState('')
  const [checkoutPrevisto, setCheckoutPrevisto] = useState('')
  const [valorPacote, setValorPacote] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const noites = checkinPrevisto && checkoutPrevisto ? calcNoites(checkinPrevisto, checkoutPrevisto) : 0
  const valorPacoteNum = parseFloat(valorPacote.replace(',', '.')) || 0

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('hospedagens')
      .select('*, pet:pets(nome, tutor:tutores(nome))')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const hosp = data as Hospedagem
          setH(hosp)
          setCheckinPrevisto(toLocalDatetimeValue(hosp.checkin_previsto))
          setCheckoutPrevisto(toLocalDatetimeValue(hosp.checkout_previsto))
          const pacote = hosp.valor_pacote != null && hosp.valor_pacote > 0
            ? hosp.valor_pacote
            : hosp.valor_diaria * Math.max(1, calcNoites(hosp.checkin_previsto, hosp.checkout_previsto))
          setValorPacote(pacote.toFixed(2))
          setObservacoes(hosp.observacoes ?? '')
        }
        setLoading(false)
      })
  }, [id])

  async function salvar() {
    setErro('')
    if (new Date(checkinPrevisto) >= new Date(checkoutPrevisto)) {
      setErro('Check-out deve ser depois do check-in.')
      return
    }
    const valor = parseFloat(valorPacote.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor inválido.'); return }

    setSaving(true)
    const supabase = createClient()
    const nNoites = calcNoites(checkinPrevisto, checkoutPrevisto)
    const { error } = await supabase.from('hospedagens').update({
      checkin_previsto: new Date(checkinPrevisto).toISOString(),
      checkout_previsto: new Date(checkoutPrevisto).toISOString(),
      valor_pacote: valor,
      valor_diaria: nNoites > 0 ? Math.round((valor / nNoites) * 100) / 100 : 0,
      observacoes: observacoes || null,
    }).eq('id', id)

    if (error) { setErro(error.message); setSaving(false); return }
    router.push(`/hotel/reservas/${id}`)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  const pet = h?.pet as { nome: string; tutor: { nome: string } } | undefined

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href={`/hotel/reservas/${id}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Reserva</h1>
          <p className="text-sm text-gray-500">{pet?.nome} · {pet?.tutor?.nome}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Check-in</label>
          <input
            type="datetime-local"
            value={checkinPrevisto}
            onChange={e => setCheckinPrevisto(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Check-out</label>
          <input
            type="datetime-local"
            value={checkoutPrevisto}
            onChange={e => setCheckoutPrevisto(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Valor total do pacote (R$)
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={valorPacote}
          onChange={e => setValorPacote(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
        {noites > 0 && valorPacoteNum > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {noites} noite{noites !== 1 ? 's' : ''} — equivale a R$ {(valorPacoteNum / noites).toFixed(2).replace('.', ',')} por diária
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observações</label>
        <textarea
          rows={3}
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>
        Salvar alterações
      </Button>
    </div>
  )
}
