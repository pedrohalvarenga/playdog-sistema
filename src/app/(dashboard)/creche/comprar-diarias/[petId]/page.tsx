'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft, Dog } from 'lucide-react'
import Link from 'next/link'
import type { Pet, Tutor, FormaPagamentoCreche } from '@/types'

const FORMAS: { value: FormaPagamentoCreche; label: string }[] = [
  { value: 'pix_pagbank', label: 'Pix PagBank' },
  { value: 'pix_c6', label: 'Pix C6' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
]

type PetComTutor = Pet & { tutor: Tutor }

export default function ComprarDiariasPage() {
  const params = useParams()
  const petId = params.petId as string
  const router = useRouter()

  const [pet, setPet] = useState<PetComTutor | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [quantidade, setQuantidade] = useState('10')
  const [valorPago, setValorPago] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoCreche>('pix_pagbank')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('pets')
        .select('*, tutor:tutores(*)')
        .eq('id', petId)
        .single()
      setPet(data as PetComTutor)
      setLoading(false)
    }
    load()
  }, [petId])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!pet) return
    setSalvando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const qtd = parseInt(quantidade)
    const valor = parseFloat(valorPago.replace(',', '.')) || 0

    // Registra a compra
    const { error: errCompra } = await supabase.from('compras_diarias').insert({
      pet_id: petId,
      tutor_id: pet.tutor_id,
      quantidade: qtd,
      valor_pago: valor,
      forma_pagamento: formaPagamento,
      data,
      observacoes: observacoes || null,
      registrado_por: user?.id,
    })

    if (errCompra) { setSalvando(false); alert('Erro ao registrar compra'); return }

    // Credita saldo no pet
    const { error: errSaldo } = await supabase
      .from('pets')
      .update({ saldo_diarias: (pet.saldo_diarias ?? 0) + qtd })
      .eq('id', petId)

    if (errSaldo) { setSalvando(false); alert('Compra registrada mas erro ao atualizar saldo'); return }

    router.push('/creche')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    )
  }

  if (!pet) return <div className="py-20 text-center text-gray-400">Pet não encontrado</div>

  const saldoNovo = (pet.saldo_diarias ?? 0) + (parseInt(quantidade) || 0)

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Comprar Diárias</h1>
      </div>

      {/* Info do pet */}
      <div className="bg-brand-purple rounded-3xl p-4 mb-5 text-white flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Dog size={24} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-lg">{pet.nome}</p>
          {pet.identificador && <p className="text-white/70 text-sm">{pet.identificador}</p>}
          <p className="text-white/70 text-sm">{pet.tutor.nome}</p>
          <p className="text-white/90 text-sm font-semibold mt-1">
            Saldo atual: <span className={pet.saldo_diarias < 0 ? 'text-red-300' : 'text-green-300'}>{pet.saldo_diarias} diária{pet.saldo_diarias !== 1 ? 's' : ''}</span>
          </p>
        </div>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <Input
            label="Quantidade de diárias"
            type="number"
            min="1"
            value={quantidade}
            onChange={e => setQuantidade(e.target.value)}
            required
          />

          <Input
            label="Valor pago (R$)"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={valorPago}
            onChange={e => setValorPago(e.target.value)}
          />

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Forma de pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormaPagamento(f.value)}
                  className={`py-2.5 px-3 rounded-2xl text-sm font-semibold transition-all ${formaPagamento === f.value ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Data"
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
              placeholder="Notas sobre o pagamento..."
            />
          </div>

          {quantidade && parseInt(quantidade) > 0 && (
            <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${saldoNovo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              Novo saldo após compra: {saldoNovo} diária{saldoNovo !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <Button type="submit" size="lg" loading={salvando}>
          Confirmar Compra
        </Button>
      </form>
    </div>
  )
}
