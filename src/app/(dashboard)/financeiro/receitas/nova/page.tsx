'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import {
  AREA_LABELS, CATEGORIA_RECEITA_LABELS, FORMA_PAGAMENTO_LABELS,
  TAXAS_PADRAO, calcValorLiquido, formatCurrency, CATEGORIAS_POR_AREA,
} from '@/lib/financeiro'
import type { ContaFinanceira, AreaNegocio, CategoriaReceita, FormaPagamento } from '@/types/financeiro'

export default function NovaReceitaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [contas, setContas] = useState<ContaFinanceira[]>([])

  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(hoje)
  const [valor, setValor] = useState(0)
  const [area, setArea] = useState<AreaNegocio>('creche')
  const [categoria, setCategoria] = useState<CategoriaReceita>('diaria_avulsa')
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [contaId, setContaId] = useState('')
  const [taxaCartao, setTaxaCartao] = useState<number | ''>('')
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago')
  const [dataVenc, setDataVenc] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tutorBusca, setTutorBusca] = useState('')
  const [tutores, setTutores] = useState<{ id: string; nome: string }[]>([])
  const [tutorId, setTutorId] = useState('')
  const [petBusca, setPetBusca] = useState('')
  const [pets, setPets] = useState<{ id: string; nome: string }[]>([])
  const [petId, setPetId] = useState('')
  const [numDiarias, setNumDiarias] = useState<number | ''>('')
  const [erro, setErro] = useState('')

  const CATEGORIAS_CRECHE: string[] = ['diaria_avulsa', 'pacote_semanal', 'pacote_mensal']
  const mostrarDiarias = area === 'creche' && CATEGORIAS_CRECHE.includes(categoria)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('contas_financeiras').select('*').eq('ativo', true)
      .then(({ data }) => {
        if (data) {
          setContas(data as ContaFinanceira[])
          setContaId(data[0]?.id ?? '')
        }
      })
  }, [])

  // Atualiza taxa padrão quando muda forma e conta
  useEffect(() => {
    const conta = contas.find(c => c.id === contaId)
    if ((forma === 'debito' || forma === 'credito') && conta?.tipo === 'pagbank_pj') {
      setTaxaCartao(TAXAS_PADRAO[forma])
    } else {
      setTaxaCartao('')
    }
  }, [forma, contaId, contas])

  // Filtra categorias pela área
  useEffect(() => {
    const cats = CATEGORIAS_POR_AREA[area]
    if (!cats.includes(categoria)) setCategoria(cats[0])
  }, [area])

  // Busca tutores
  useEffect(() => {
    if (tutorBusca.length < 2) { setTutores([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('tutores').select('id, nome').ilike('nome', `%${tutorBusca}%`).limit(5)
      if (data) setTutores(data)
    }, 300)
    return () => clearTimeout(t)
  }, [tutorBusca])

  // Busca pets
  useEffect(() => {
    if (petBusca.length < 2) { setPets([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('pets').select('id, nome').ilike('nome', `%${petBusca}%`).limit(5)
      if (data) setPets(data)
    }, 300)
    return () => clearTimeout(t)
  }, [petBusca])

  const conta = contas.find(c => c.id === contaId)
  const mostrarTaxa = (forma === 'debito' || forma === 'credito') && conta?.tipo === 'pagbank_pj'
  const valorLiquido = mostrarTaxa && typeof taxaCartao === 'number' && taxaCartao > 0
    ? calcValorLiquido(valor, taxaCartao) : null

  async function salvar() {
    if (valor <= 0) { setErro('Informe o valor.'); return }
    if (!contaId) { setErro('Selecione a conta.'); return }
    if (status === 'pendente' && !dataVenc) { setErro('Informe a data de vencimento.'); return }
    setErro(''); setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('receitas').insert({
      data, valor, area, categoria,
      forma_pagamento: forma,
      conta_id: contaId,
      taxa_cartao: mostrarTaxa && typeof taxaCartao === 'number' ? taxaCartao : null,
      valor_liquido: valorLiquido,
      tutor_id: tutorId || null,
      pet_id: petId || null,
      descricao: descricao || null,
      num_diarias: mostrarDiarias && numDiarias !== '' ? numDiarias : null,
      status,
      data_vencimento: status === 'pendente' ? dataVenc : null,
    })
    setSaving(false)
    if (error) { setErro(error.message); return }
    router.push('/financeiro/receitas')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/receitas" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nova Receita</h1>
      </div>

      {/* Data */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Data</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      {/* Valor */}
      <CurrencyInput label="Valor (bruto)" value={valor} onChange={setValor} autoFocus />

      {/* Área */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Área / Centro de custo</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(AREA_LABELS) as AreaNegocio[]).map(a => (
            <button key={a} type="button"
              onClick={() => setArea(a)}
              className={`py-2.5 px-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                area === a ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Categoria */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Categoria</label>
        <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaReceita)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
          {CATEGORIAS_POR_AREA[area].map(c => (
            <option key={c} value={c}>{CATEGORIA_RECEITA_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Número de diárias (somente creche) */}
      {mostrarDiarias && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Nº de diárias</label>
          <input
            type="number" min="1" step="1" placeholder="Ex: 22"
            value={numDiarias}
            onChange={e => setNumDiarias(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
          />
          <p className="text-xs text-gray-400">Quantas diárias este pagamento cobre</p>
        </div>
      )}

      {/* Forma de pagamento */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Forma de pagamento</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FORMA_PAGAMENTO_LABELS) as FormaPagamento[]).map(f => (
            <button key={f} type="button"
              onClick={() => setForma(f)}
              className={`py-2.5 px-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                forma === f ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {FORMA_PAGAMENTO_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Conta de destino */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Conta de destino</label>
        <div className="flex flex-col gap-2">
          {contas.map(c => (
            <button key={c.id} type="button"
              onClick={() => setContaId(c.id)}
              className={`py-2.5 px-4 rounded-2xl text-sm font-semibold border-2 text-left transition-colors ${
                contaId === c.id ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Taxa de cartão (PagBank débito/crédito) */}
      {mostrarTaxa && (
        <div className="flex flex-col gap-2 bg-orange-50 rounded-2xl p-4 border border-orange-200">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-800">Taxa do cartão PagBank</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-orange-700 mb-1 block">Taxa (%)</label>
              <input
                type="number" step="0.01" min="0" max="100"
                value={taxaCartao}
                onChange={e => setTaxaCartao(parseFloat(e.target.value) || '')}
                className="w-full py-2 px-3 rounded-xl border border-orange-300 focus:border-orange-500 outline-none text-sm bg-white"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-orange-700 mb-1">Valor líquido</p>
              <p className="font-bold text-orange-800 text-lg">
                {valorLiquido != null ? formatCurrency(valorLiquido) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Status</label>
        <div className="grid grid-cols-2 gap-2">
          {(['pago', 'pendente'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                status === s ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {s === 'pago' ? 'Pago' : 'Pendente'}
            </button>
          ))}
        </div>
      </div>

      {status === 'pendente' && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Data de vencimento</label>
          <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
        </div>
      )}

      {/* Tutor (opcional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Tutor (opcional)</label>
        {tutorId ? (
          <div className="flex items-center gap-2 py-3 px-4 rounded-2xl bg-purple-50 border-2 border-brand-purple">
            <span className="text-sm font-semibold text-brand-purple flex-1">
              {tutores.find(t => t.id === tutorId)?.nome ?? ''}
            </span>
            <button type="button" onClick={() => { setTutorId(''); setTutorBusca('') }}
              className="text-xs text-gray-400">remover</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <input type="text" placeholder="Buscar tutor..." value={tutorBusca}
              onChange={e => setTutorBusca(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            {tutores.length > 0 && (
              <div className="flex flex-col gap-1">
                {tutores.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => { setTutorId(t.id); setTutorBusca(t.nome); setTutores([]) }}
                    className="py-2 px-4 rounded-xl bg-white border border-gray-200 text-sm text-left hover:border-brand-purple">
                    {t.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pet (opcional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Pet (opcional)</label>
        {petId ? (
          <div className="flex items-center gap-2 py-3 px-4 rounded-2xl bg-purple-50 border-2 border-brand-purple">
            <span className="text-sm font-semibold text-brand-purple flex-1">
              {pets.find(p => p.id === petId)?.nome ?? petBusca}
            </span>
            <button type="button" onClick={() => { setPetId(''); setPetBusca('') }}
              className="text-xs text-gray-400">remover</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <input type="text" placeholder="Buscar pet..." value={petBusca}
              onChange={e => setPetBusca(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            {pets.length > 0 && (
              <div className="flex flex-col gap-1">
                {pets.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setPetId(p.id); setPetBusca(p.nome); setPets([]) }}
                    className="py-2 px-4 rounded-xl bg-white border border-gray-200 text-sm text-left hover:border-brand-purple">
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Descrição (opcional)</label>
        <input type="text" placeholder="Ex: Pacote mensal — Buddy" value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button size="lg" onClick={salvar} loading={saving}>
        Salvar receita
      </Button>
    </div>
  )
}
