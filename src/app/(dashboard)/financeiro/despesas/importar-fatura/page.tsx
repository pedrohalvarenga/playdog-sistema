'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Sparkles, AlertTriangle, CheckCircle2, Trash2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { AREA_LABELS, CATEGORIA_DESPESA_LABELS, formatCurrency } from '@/lib/financeiro'
import type { ContaFinanceira, AreaNegocio, CategoriaDespesa } from '@/types/financeiro'
import { hojeLocal } from '@/lib/datas'

const CATEGORIAS_DESPESA: CategoriaDespesa[] = [
  'racao_petiscos', 'limpeza', 'produtos_banho_tosa', 'salarios', 'comissoes',
  'combustivel', 'manutencao', 'investimento', 'aluguel', 'agua_luz_internet',
  'contador', 'marketing', 'impostos', 'taxas_bancarias', 'vacinas_veterinario', 'outros',
]
const AREAS: AreaNegocio[] = ['creche', 'hotel', 'loja', 'banho_tosa', 'transporte', 'veterinario', 'geral', 'outros']

type ItemFatura = {
  data: string | null
  descricao: string
  valor: number
  categoria: CategoriaDespesa
  area: AreaNegocio
  confianca: 'alta' | 'media' | 'baixa'
  incluir: boolean
}

export default function ImportarFaturaPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'revisar' | 'feito'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState('')

  const [itens, setItens] = useState<ItemFatura[]>([])
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [contaId, setContaId] = useState('')
  const [dataPagamento, setDataPagamento] = useState(hojeLocal())
  const [salvando, setSalvando] = useState(false)
  const [qtdLancada, setQtdLancada] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('contas_financeiras').select('*').eq('ativo', true).then(({ data }) => {
      if (data) { setContas(data as ContaFinanceira[]); setContaId(data[0]?.id ?? '') }
    })
  }, [])

  async function analisar() {
    if (!file) { setErro('Selecione o arquivo da fatura.'); return }
    setErro(''); setAnalisando(true)
    try {
      const fd = new FormData()
      fd.append('arquivo', file)
      const res = await fetch('/api/financeiro/importar-fatura', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Falha ao analisar a fatura.'); setAnalisando(false); return }
      const lidos = (json.itens ?? []) as Omit<ItemFatura, 'incluir'>[]
      if (lidos.length === 0) {
        setErro('A IA não encontrou compras nesta fatura. Tente uma foto mais nítida ou o PDF original.')
        setAnalisando(false); return
      }
      setItens(lidos.map(it => ({ ...it, incluir: true })))
      setStep('revisar')
    } catch {
      setErro('Erro de conexão ao analisar a fatura.')
    }
    setAnalisando(false)
  }

  function atualizar(idx: number, patch: Partial<ItemFatura>) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const selecionados = itens.filter(it => it.incluir)
  const total = selecionados.reduce((s, it) => s + it.valor, 0)

  async function lancar() {
    if (salvando) return
    if (!contaId) { setErro('Selecione a conta de origem.'); return }
    if (selecionados.length === 0) { setErro('Nenhum item selecionado.'); return }
    setErro(''); setSalvando(true)
    const supabase = createClient()
    const linhas = selecionados.map(it => ({
      data: it.data || dataPagamento,
      valor: it.valor,
      area: it.area,
      categoria: it.categoria,
      conta_id: contaId,
      descricao: it.descricao || null,
      status: 'pago' as const,
      data_pagamento: dataPagamento,
    }))
    const { error } = await supabase.from('despesas').insert(linhas)
    if (error) { setErro(error.message); setSalvando(false); return }
    setQtdLancada(linhas.length)
    setStep('feito')
  }

  // ---------- TELA: SUCESSO ----------
  if (step === 'feito') {
    return (
      <div className="py-6 flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={56} className="text-green-500" />
        <h1 className="text-xl font-bold text-gray-900">{qtdLancada} despesas lançadas!</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          As compras da fatura entraram no financeiro já categorizadas. Confira na lista de despesas.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <Link href="/financeiro/despesas">
            <Button size="lg" variant="primary" className="w-full">Ver despesas</Button>
          </Link>
          <button onClick={() => { setStep('upload'); setFile(null); setItens([]) }}
            className="text-sm text-gray-400 font-semibold py-2">Importar outra fatura</button>
        </div>
      </div>
    )
  }

  // ---------- TELA: REVISÃO ----------
  if (step === 'revisar') {
    return (
      <div className="py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('upload')} className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></button>
          <h1 className="text-xl font-bold text-gray-900">Revisar fatura</h1>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Confira cada item antes de lançar. Itens marcados em <strong>laranja</strong> a IA teve menos certeza —
            revise a categoria. Não lance também a fatura inteira como uma despesa só (viraria valor dobrado).
          </p>
        </div>

        {/* Conta + data de pagamento (valem para todos) */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-700">Conta que pagou a fatura</label>
            <select value={contaId} onChange={e => setContaId(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-700">Data de pagamento da fatura</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            <p className="text-xs text-gray-400">Entra no caixa nesta data. A data de cada compra é mantida para a competência.</p>
          </div>
        </div>

        {/* Itens */}
        <div className="flex flex-col gap-3">
          {itens.map((it, idx) => (
            <div key={idx}
              className={`rounded-2xl border-2 p-3 flex flex-col gap-2 ${
                !it.incluir ? 'border-gray-200 bg-gray-50 opacity-60'
                  : it.confianca === 'baixa' ? 'border-amber-300 bg-amber-50/40'
                  : 'border-gray-200 bg-white'
              }`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={it.incluir} onChange={e => atualizar(idx, { incluir: e.target.checked })}
                  className="w-5 h-5 rounded accent-brand-purple flex-shrink-0" />
                <input type="text" value={it.descricao} onChange={e => atualizar(idx, { descricao: e.target.value })}
                  placeholder="Descrição"
                  className="flex-1 min-w-0 py-2 px-3 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
                <button onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={16} /></button>
              </div>

              <div className="flex items-center gap-2 pl-7">
                <input type="number" step="0.01" value={it.valor}
                  onChange={e => atualizar(idx, { valor: parseFloat(e.target.value) || 0 })}
                  className="w-28 py-2 px-3 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white font-semibold text-red-600" />
                <input type="date" value={it.data ?? ''} onChange={e => atualizar(idx, { data: e.target.value || null })}
                  className="flex-1 min-w-0 py-2 px-3 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-xs bg-white text-gray-500" />
              </div>

              <div className="grid grid-cols-2 gap-2 pl-7">
                <select value={it.categoria} onChange={e => atualizar(idx, { categoria: e.target.value as CategoriaDespesa })}
                  className="w-full py-2 px-3 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
                  {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{CATEGORIA_DESPESA_LABELS[c]}</option>)}
                </select>
                <select value={it.area} onChange={e => atualizar(idx, { area: e.target.value as AreaNegocio })}
                  className="w-full py-2 px-3 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
                  {AREAS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

        <div className="sticky bottom-4 bg-white rounded-2xl border-2 border-gray-200 p-4 flex items-center gap-3 shadow-lg">
          <div className="flex-1">
            <p className="text-xs text-gray-400">{selecionados.length} de {itens.length} selecionadas</p>
            <p className="font-bold text-red-600">{formatCurrency(total)}</p>
          </div>
          <Button variant="danger" onClick={lancar} loading={salvando} disabled={selecionados.length === 0}>
            Lançar {selecionados.length} {selecionados.length === 1 ? 'despesa' : 'despesas'}
          </Button>
        </div>
      </div>
    )
  }

  // ---------- TELA: UPLOAD ----------
  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/despesas" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Importar fatura do cartão</h1>
      </div>

      <div className="flex items-start gap-2 bg-purple-50 rounded-2xl p-4 border border-purple-200">
        <Sparkles size={18} className="text-brand-purple flex-shrink-0 mt-0.5" />
        <p className="text-sm text-purple-800">
          Envie a fatura do cartão (PDF ou foto) e a IA lê cada compra, classifica por categoria e área,
          e prepara tudo para você revisar e lançar de uma vez.
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept="application/pdf,image/*"
        onChange={e => { setFile(e.target.files?.[0] ?? null); setErro('') }} className="hidden" />

      <button onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed border-gray-300 bg-white text-gray-400 hover:border-brand-purple hover:text-brand-purple transition-colors">
        {file ? <FileText size={40} /> : <Upload size={40} />}
        <span className="text-sm font-semibold px-4 text-center">
          {file ? file.name : 'Toque para escolher a fatura (PDF ou foto)'}
        </span>
      </button>

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button size="lg" variant="primary" onClick={analisar} loading={analisando} disabled={!file}>
        {analisando ? 'Lendo a fatura...' : 'Analisar com IA'}
      </Button>

      <p className="text-xs text-gray-400 text-center px-4">
        A análise pode levar alguns segundos. Nada é lançado automaticamente —
        você revisa cada item antes de confirmar.
      </p>
    </div>
  )
}
