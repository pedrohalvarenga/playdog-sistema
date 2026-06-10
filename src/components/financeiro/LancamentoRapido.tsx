'use client'

import { useState, useEffect } from 'react'
import { Plus, X, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  AREA_LABELS, CATEGORIA_RECEITA_LABELS, CATEGORIA_DESPESA_LABELS,
  FORMA_PAGAMENTO_LABELS, TAXAS_PADRAO, ATALHOS_RAPIDOS,
  calcValorLiquido, formatCurrency, parseCurrencyInput,
} from '@/lib/financeiro'
import type { ContaFinanceira } from '@/types/financeiro'
import type { AreaNegocio, CategoriaReceita, CategoriaDespesa, FormaPagamento } from '@/types/financeiro'

type Tipo = 'receita' | 'despesa'
type Step = 'tipo' | 'valor' | 'area' | 'categoria' | 'diarias' | 'forma' | 'conta' | 'ok'

const CATEGORIAS_RECEITA_AREA: Record<AreaNegocio, CategoriaReceita[]> = {
  creche:     ['diaria_avulsa', 'pacote_semanal', 'pacote_mensal'],
  hotel:      ['hotel'],
  loja:       ['venda_produto'],
  banho_tosa: ['banho_tosa'],
  transporte: ['transporte'],
  outros:     ['festa', 'foto', 'outros'],
  geral:      ['outros'],
}

const CATEGORIAS_DESPESA_AREA: Record<AreaNegocio, CategoriaDespesa[]> = {
  creche:     ['racao_petiscos', 'limpeza', 'salarios', 'manutencao', 'outros'],
  hotel:      ['racao_petiscos', 'limpeza', 'salarios', 'manutencao', 'outros'],
  loja:       ['outros'],
  banho_tosa: ['produtos_banho_tosa', 'comissoes', 'outros'],
  transporte: ['combustivel', 'manutencao', 'outros'],
  outros:     ['marketing', 'impostos', 'taxas_bancarias', 'outros'],
  geral:      ['aluguel', 'agua_luz_internet', 'contador', 'salarios', 'impostos', 'taxas_bancarias', 'outros'],
}

export default function LancamentoRapido() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('tipo')
  const [tipo, setTipo] = useState<Tipo>('receita')
  const [valorRaw, setValorRaw] = useState('')
  const [area, setArea] = useState<AreaNegocio | null>(null)
  const [categoria, setCategoria] = useState<string | null>(null)
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [conta, setConta] = useState<string | null>(null)
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [numDiarias, setNumDiarias] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const CATEGORIAS_CRECHE = ['diaria_avulsa', 'pacote_semanal', 'pacote_mensal']

  useEffect(() => {
    if (open) {
      const supabase = createClient()
      supabase.from('contas_financeiras').select('*').eq('ativo', true).then(({ data }) => {
        if (data) setContas(data as ContaFinanceira[])
      })
    }
  }, [open])

  function reset() {
    setStep('tipo'); setTipo('receita'); setValorRaw('')
    setArea(null); setCategoria(null); setForma('pix'); setConta(null); setNumDiarias('')
  }

  function fechar() { setOpen(false); reset() }

  function formatDisplay(digits: string) {
    if (!digits) return 'R$ 0,00'
    const num = parseInt(digits, 10)
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num / 100)
  }

  function digitarValor(d: string) {
    if (d === 'del') { setValorRaw(prev => prev.slice(0, -1)); return }
    if (d === 'ok') { if (parseCurrencyInput(valorRaw) > 0) setStep('area'); return }
    setValorRaw(prev => (prev + d).slice(-10))
  }

  async function salvar() {
    if (!area || !categoria || !conta) return
    setSaving(true)
    const supabase = createClient()
    const valor = parseCurrencyInput(valorRaw)
    const contaSel = contas.find(c => c.id === conta)
    const taxa = (tipo === 'receita' && (forma === 'debito' || forma === 'credito') && contaSel?.tipo === 'pagbank_pj')
      ? TAXAS_PADRAO[forma] : undefined
    const valor_liquido = taxa ? calcValorLiquido(valor, taxa) : undefined

    if (tipo === 'receita') {
      await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor, area, categoria, forma_pagamento: forma,
        conta_id: conta, taxa_cartao: taxa, valor_liquido, status: 'pago',
        num_diarias: numDiarias !== '' ? numDiarias : null,
      })
    } else {
      await supabase.from('despesas').insert({
        data: new Date().toISOString().split('T')[0],
        valor, area, categoria, conta_id: conta, status: 'pago',
      })
    }
    setSaving(false)
    setStep('ok')
  }

  // Atalho rápido da tela tipo
  async function usarAtalho(a: typeof ATALHOS_RAPIDOS[0]) {
    setTipo('receita'); setArea(a.area); setCategoria(a.categoria)
    setStep('valor')
  }

  const categorias = area
    ? (tipo === 'receita' ? CATEGORIAS_RECEITA_AREA[area] : CATEGORIAS_DESPESA_AREA[area])
    : []

  // Contas compatíveis com forma de pagamento
  const contasFiltradas = forma === 'pix'
    ? contas
    : forma === 'dinheiro'
    ? contas.filter(c => c.tipo === 'dinheiro')
    : contas.filter(c => c.tipo === 'pagbank_pj')

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Lançamento rápido"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={fechar}>
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-28 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">
                {step === 'ok' ? '✓ Lançado!' : 'Lançamento Rápido'}
              </h2>
              <button onClick={fechar} className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {/* STEP: tipo */}
            {step === 'tipo' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {(['receita', 'despesa'] as Tipo[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTipo(t); setStep('valor') }}
                      className={cn(
                        'py-4 rounded-2xl font-bold text-base border-2 transition-colors',
                        t === 'receita'
                          ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-red-400 text-red-700 bg-red-50 hover:bg-red-100'
                      )}
                    >
                      {t === 'receita' ? '+ Receita' : '− Despesa'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">ou use um atalho:</p>
                <div className="grid grid-cols-2 gap-2">
                  {ATALHOS_RAPIDOS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => usarAtalho(a)}
                      className="py-3 px-3 rounded-2xl bg-purple-50 text-purple-700 font-semibold text-sm border-2 border-purple-200 active:scale-95 transition-transform flex items-center justify-between"
                    >
                      {a.label}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: valor — teclado numérico */}
            {step === 'valor' && (
              <div className="flex flex-col gap-3">
                <div className={cn(
                  'text-center text-4xl font-bold py-4 rounded-2xl',
                  tipo === 'receita' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                )}>
                  {formatDisplay(valorRaw)}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9','del','0','ok'].map(d => (
                    <button
                      key={d}
                      onClick={() => digitarValor(d)}
                      className={cn(
                        'h-14 rounded-2xl font-bold text-lg transition-all active:scale-95',
                        d === 'ok'
                          ? 'bg-brand-purple text-white col-span-1'
                          : d === 'del'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      )}
                    >
                      {d === 'del' ? '⌫' : d === 'ok' ? 'OK →' : d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: área */}
            {step === 'area' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500 font-medium">Área / Centro de custo</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(AREA_LABELS) as AreaNegocio[]).map(a => (
                    <button
                      key={a}
                      onClick={() => { setArea(a); setCategoria(null); setStep('categoria') }}
                      className="py-3 px-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-semibold text-sm text-left hover:border-brand-purple hover:bg-purple-50 transition-colors active:scale-95"
                    >
                      {AREA_LABELS[a]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: categoria */}
            {step === 'categoria' && area && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500 font-medium">Categoria</p>
                <div className="grid grid-cols-2 gap-2">
                  {categorias.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                      setCategoria(cat)
                      if (tipo === 'receita' && CATEGORIAS_CRECHE.includes(cat)) setStep('diarias')
                      else setStep(tipo === 'receita' ? 'forma' : 'conta')
                    }}
                      className="py-3 px-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-semibold text-sm text-left hover:border-brand-purple hover:bg-purple-50 transition-colors active:scale-95"
                    >
                      {tipo === 'receita'
                        ? CATEGORIA_RECEITA_LABELS[cat as CategoriaReceita]
                        : CATEGORIA_DESPESA_LABELS[cat as CategoriaDespesa]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: número de diárias (creche) */}
            {step === 'diarias' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500 font-medium">Nº de diárias</p>
                <input
                  type="number" min="1" step="1" placeholder="Ex: 22"
                  value={numDiarias}
                  onChange={e => setNumDiarias(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-lg bg-white text-center font-bold"
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center">Quantas diárias este pagamento cobre</p>
                <button
                  onClick={() => setStep('forma')}
                  className="w-full py-3 rounded-2xl bg-brand-purple text-white font-bold"
                >
                  Continuar →
                </button>
                <button
                  onClick={() => { setNumDiarias(''); setStep('forma') }}
                  className="w-full py-2 rounded-2xl text-gray-400 text-sm"
                >
                  Pular
                </button>
              </div>
            )}

            {/* STEP: forma de pagamento (só receita) */}
            {step === 'forma' && tipo === 'receita' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500 font-medium">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FORMA_PAGAMENTO_LABELS) as FormaPagamento[]).map(f => (
                    <button
                      key={f}
                      onClick={() => { setForma(f); setStep('conta') }}
                      className="py-3 px-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-bold text-sm hover:border-brand-purple hover:bg-purple-50 transition-colors active:scale-95"
                    >
                      {FORMA_PAGAMENTO_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: conta */}
            {step === 'conta' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500 font-medium">
                  Conta {tipo === 'receita' ? 'de destino' : 'de origem'}
                </p>
                {contasFiltradas.length === 0 && <p className="text-sm text-gray-400">Nenhuma conta disponível.</p>}
                {contasFiltradas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setConta(c.id); salvar() }}
                    className="py-3 px-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-bold text-sm text-left hover:border-brand-purple hover:bg-purple-50 transition-colors active:scale-95"
                  >
                    {c.nome}
                    {tipo === 'receita' && (forma === 'debito' || forma === 'credito') && c.tipo === 'pagbank_pj' && (
                      <span className="text-xs text-gray-400 font-normal block">
                        Taxa {TAXAS_PADRAO[forma]}% → líquido {formatCurrency(calcValorLiquido(parseCurrencyInput(valorRaw), TAXAS_PADRAO[forma]))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* STEP: OK */}
            {step === 'ok' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 size={56} className="text-green-500" />
                <p className="font-bold text-gray-900 text-lg">Lançamento salvo!</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => { reset(); setStep('tipo') }}
                    className="flex-1 py-3 rounded-2xl bg-brand-purple text-white font-bold"
                  >
                    + Novo
                  </button>
                  <button
                    onClick={fechar}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* Barra de progresso / step indicator */}
            {step !== 'ok' && step !== 'tipo' && (
              <div className="flex gap-1 justify-center mt-1">
                {(['valor','area','categoria','diarias','forma','conta'] as Step[]).map((s, i) => (
                  <div key={s} className={cn(
                    'h-1.5 rounded-full transition-all',
                    step === s ? 'w-6 bg-brand-purple' : i < ['valor','area','categoria','diarias','forma','conta'].indexOf(step) ? 'w-3 bg-brand-purple/50' : 'w-3 bg-gray-200'
                  )} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </>
  )
}
