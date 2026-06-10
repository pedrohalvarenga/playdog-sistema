'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import { AREA_LABELS, formatCurrency, gerarDatasParcelas } from '@/lib/financeiro'
import type { ContaFinanceira, AreaNegocio } from '@/types/financeiro'

export default function NovoParcelamentoPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [numParcelas, setNumParcelas] = useState(12)
  const [valorParcela, setValorParcela] = useState(0)
  const [taxaJuros, setTaxaJuros] = useState('')
  const [dataPrimeira, setDataPrimeira] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1)
    return d.toISOString().split('T')[0]
  })
  const [contaId, setContaId] = useState('')
  const [area, setArea] = useState<AreaNegocio>('geral')
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('contas_financeiras').select('*').eq('ativo', true).then(({ data }) => {
      if (data) { setContas(data as ContaFinanceira[]); setContaId(data[0]?.id ?? '') }
    })
  }, [])

  // Auto-calcula valor da parcela
  useEffect(() => {
    if (valorTotal > 0 && numParcelas > 0) {
      setValorParcela(Math.round(valorTotal / numParcelas * 100) / 100)
    }
  }, [valorTotal, numParcelas])

  const datas = dataPrimeira && numParcelas > 0 ? gerarDatasParcelas(dataPrimeira, numParcelas) : []

  async function salvar() {
    if (!descricao) { setErro('Informe a descrição.'); return }
    if (valorParcela <= 0) { setErro('Informe o valor da parcela.'); return }
    if (!contaId) { setErro('Selecione a conta.'); return }
    if (!dataPrimeira) { setErro('Informe a data da 1ª parcela.'); return }
    setErro(''); setSaving(true)
    const supabase = createClient()

    // Cria o parcelamento
    const { data: parc, error: errParc } = await supabase.from('parcelamentos').insert({
      descricao,
      valor_total: valorTotal || numParcelas * valorParcela,
      num_parcelas: numParcelas,
      valor_parcela: valorParcela,
      taxa_juros: taxaJuros ? parseFloat(taxaJuros) : null,
      data_primeira_parcela: dataPrimeira,
      conta_id: contaId,
      area,
    }).select('id').single()

    if (errParc || !parc) { setErro(errParc?.message ?? 'Erro ao criar parcelamento'); setSaving(false); return }

    // Gera as parcelas como despesas pendentes
    const despesas = datas.map((dt, i) => ({
      data: dt,
      data_vencimento: dt,
      valor: valorParcela,
      area,
      categoria: 'outros' as const,
      conta_id: contaId,
      descricao: `${descricao} — parcela ${i + 1}/${numParcelas}`,
      status: 'pendente' as const,
      parcelamento_id: parc.id,
      num_parcela: i + 1,
    }))

    const { error: errDesp } = await supabase.from('despesas').insert(despesas)
    setSaving(false)
    if (errDesp) { setErro(errDesp.message); return }
    router.push('/financeiro/parcelamentos')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/parcelamentos" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Novo Parcelamento</h1>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Descrição</label>
        <input type="text" placeholder="Ex: Equipamento de banho" value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <CurrencyInput label="Valor total (opcional)" value={valorTotal} onChange={setValorTotal} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Nº de parcelas</label>
          <input type="number" min="1" max="360" value={numParcelas}
            onChange={e => setNumParcelas(Number(e.target.value))}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Valor da parcela</label>
          <CurrencyInput value={valorParcela} onChange={setValorParcela} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Juros (% a.m. — opcional)</label>
        <input type="number" step="0.01" min="0" placeholder="Ex: 1.99" value={taxaJuros}
          onChange={e => setTaxaJuros(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Data da 1ª parcela</label>
        <input type="date" value={dataPrimeira} onChange={e => setDataPrimeira(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Conta de pagamento</label>
        <div className="flex flex-col gap-2">
          {contas.map(c => (
            <button key={c.id} type="button" onClick={() => setContaId(c.id)}
              className={`py-2.5 px-4 rounded-2xl text-sm font-semibold border-2 text-left transition-colors ${
                contaId === c.id ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Área</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(AREA_LABELS) as AreaNegocio[]).map(a => (
            <button key={a} type="button" onClick={() => setArea(a)}
              className={`py-2.5 px-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                area === a ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Preview das parcelas */}
      {datas.length > 0 && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              <p className="text-sm font-semibold text-blue-800">
                {numParcelas}x de {formatCurrency(valorParcela)}
              </p>
            </div>
            <button type="button" onClick={() => setPreview(v => !v)}
              className="text-xs text-blue-600 font-semibold">
              {preview ? 'Ocultar' : 'Ver datas'}
            </button>
          </div>
          <p className="text-xs text-blue-600">
            Total: {formatCurrency(numParcelas * valorParcela)}
            {taxaJuros ? ` · Juros ${taxaJuros}% a.m.` : ''}
          </p>
          {preview && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {datas.map((dt, i) => (
                <div key={dt} className="flex items-center justify-between text-xs py-1 border-b border-blue-100 last:border-0">
                  <span className="text-blue-700">Parcela {i + 1}/{numParcelas}</span>
                  <span className="text-blue-600 font-medium">
                    {new Date(dt + 'T00:00:00').toLocaleDateString('pt-BR')} · {formatCurrency(valorParcela)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button size="lg" onClick={salvar} loading={saving}>
        Cadastrar e gerar parcelas
      </Button>
    </div>
  )
}
