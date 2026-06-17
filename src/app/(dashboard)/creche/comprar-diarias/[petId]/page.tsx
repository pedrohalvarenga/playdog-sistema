'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft, Dog } from 'lucide-react'
import Link from 'next/link'
import type { Pet, Tutor, FormaPagamentoCreche } from '@/types'
import type { ContaFinanceira, FormaPagamento, TipoConta, CategoriaReceita } from '@/types/financeiro'
import { TAXAS_PADRAO, calcValorLiquido } from '@/lib/financeiro'
import { hojeLocal } from '@/lib/datas'

const FORMAS: { value: FormaPagamentoCreche; label: string }[] = [
  { value: 'pix_pagbank', label: 'Pix PagBank' },
  { value: 'pix_c6', label: 'Pix C6' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
]

// Mapeia a forma de pagamento da creche para a receita do Financeiro
// (forma + tipo de conta de destino).
const MAPA_PAGAMENTO: Record<FormaPagamentoCreche, { forma: FormaPagamento; contaTipo: TipoConta }> = {
  pix_pagbank: { forma: 'pix', contaTipo: 'pagbank_pj' },
  pix_c6:      { forma: 'pix', contaTipo: 'c6_pf' },
  dinheiro:    { forma: 'dinheiro', contaTipo: 'dinheiro' },
  debito:      { forma: 'debito', contaTipo: 'pagbank_pj' },
  credito:     { forma: 'credito', contaTipo: 'pagbank_pj' },
}

type PetComTutor = Pet & { tutor: Tutor }

export default function ComprarDiariasPage() {
  const params = useParams()
  const petId = params.petId as string
  const router = useRouter()

  const [pet, setPet] = useState<PetComTutor | null>(null)
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [quantidade, setQuantidade] = useState('10')
  const [valorPago, setValorPago] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoCreche>('pix_pagbank')
  const [data, setData] = useState(() => hojeLocal())
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data }, { data: contasData }] = await Promise.all([
        supabase.from('pets').select('*, tutor:tutores(*)').eq('id', petId).single(),
        supabase.from('contas_financeiras').select('*').eq('ativo', true),
      ])
      setPet(data as PetComTutor)
      if (contasData) setContas(contasData as ContaFinanceira[])
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

    if (valor > 0) {
      // Gera a receita no Financeiro. O trigger creditar_diarias_receita
      // credita o saldo_diarias do pet automaticamente — por isso NÃO
      // creditamos o saldo na mão aqui (senão dobraria). Apagar a receita
      // no Financeiro estorna as diárias pelo mesmo trigger.
      const mapa = MAPA_PAGAMENTO[formaPagamento]
      const conta = contas.find(c => c.tipo === mapa.contaTipo)
      const aplicaTaxa = (mapa.forma === 'debito' || mapa.forma === 'credito') && conta?.tipo === 'pagbank_pj'
      const taxa = aplicaTaxa ? TAXAS_PADRAO[mapa.forma] : null
      const categoria: CategoriaReceita = qtd >= 20 ? 'pacote_mensal' : qtd >= 5 ? 'pacote_semanal' : 'diaria_avulsa'

      const { error: errReceita } = await supabase.from('receitas').insert({
        data,
        valor,
        area: 'creche',
        categoria,
        forma_pagamento: mapa.forma,
        conta_id: conta?.id ?? null,
        taxa_cartao: taxa,
        valor_liquido: taxa != null ? calcValorLiquido(valor, taxa) : null,
        tutor_id: pet.tutor_id,
        pet_id: petId,
        num_diarias: qtd,
        descricao: observacoes || `Compra de ${qtd} diária${qtd !== 1 ? 's' : ''} — ${pet.nome}`,
        status: 'pago',
        registrado_por: user?.id,
      })

      if (errReceita) {
        setSalvando(false)
        alert('Compra registrada, mas erro ao gerar a receita no Financeiro: ' + errReceita.message)
        return
      }
      // saldo_diarias é creditado pelo trigger ao inserir a receita
    } else {
      // Sem valor pago: não há movimento no Financeiro, credita o saldo na mão
      const { error: errSaldo } = await supabase
        .from('pets')
        .update({ saldo_diarias: (pet.saldo_diarias ?? 0) + qtd })
        .eq('id', petId)

      if (errSaldo) { setSalvando(false); alert('Compra registrada mas erro ao atualizar saldo'); return }
    }

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
