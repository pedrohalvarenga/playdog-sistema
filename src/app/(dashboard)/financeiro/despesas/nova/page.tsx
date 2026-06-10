'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import {
  AREA_LABELS, CATEGORIA_DESPESA_LABELS, isInvestimento,
} from '@/lib/financeiro'
import type { ContaFinanceira, AreaNegocio, CategoriaDespesa } from '@/types/financeiro'

const CATEGORIAS_DESPESA: CategoriaDespesa[] = [
  'racao_petiscos','limpeza','produtos_banho_tosa','salarios','comissoes',
  'combustivel','manutencao','investimento','aluguel','agua_luz_internet',
  'contador','marketing','impostos','taxas_bancarias','outros',
]

export default function NovaDespesaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(hoje)
  const [valor, setValor] = useState(0)
  const [area, setArea] = useState<AreaNegocio>('geral')
  const [categoria, setCategoria] = useState<CategoriaDespesa>('outros')
  const [contaId, setContaId] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tutorBusca, setTutorBusca] = useState('')
  const [tutores, setTutores] = useState<{ id: string; nome: string }[]>([])
  const [tutorId, setTutorId] = useState('')
  const [petBusca, setPetBusca] = useState('')
  const [pets, setPets] = useState<{ id: string; nome: string }[]>([])
  const [petId, setPetId] = useState('')
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago')
  const [dataVenc, setDataVenc] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [diaVencimento, setDiaVencimento] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('contas_financeiras').select('*').eq('ativo', true).then(({ data }) => {
      if (data) { setContas(data as ContaFinanceira[]); setContaId(data[0]?.id ?? '') }
    })
  }, [])

  useEffect(() => {
    if (tutorBusca.length < 2) { setTutores([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('tutores').select('id, nome').ilike('nome', `%${tutorBusca}%`).limit(5)
      if (data) setTutores(data)
    }, 300)
    return () => clearTimeout(t)
  }, [tutorBusca])

  useEffect(() => {
    if (petBusca.length < 2) { setPets([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('pets').select('id, nome').ilike('nome', `%${petBusca}%`).limit(5)
      if (data) setPets(data)
    }, 300)
    return () => clearTimeout(t)
  }, [petBusca])

  async function salvar() {
    if (valor <= 0) { setErro('Informe o valor.'); return }
    if (!contaId) { setErro('Selecione a conta.'); return }
    if (status === 'pendente' && !dataVenc) { setErro('Informe a data de vencimento.'); return }
    if (recorrente && !diaVencimento) { setErro('Informe o dia de vencimento para despesa recorrente.'); return }
    setErro(''); setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('despesas').insert({
      data, valor, area, categoria,
      conta_id: contaId,
      tutor_id: tutorId || null,
      pet_id: petId || null,
      fornecedor: fornecedor || null,
      descricao: descricao || null,
      status,
      data_vencimento: status === 'pendente' ? dataVenc : null,
      recorrente,
      dia_vencimento: recorrente ? Number(diaVencimento) : null,
    })
    setSaving(false)
    if (error) { setErro(error.message); return }
    router.push('/financeiro/despesas')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/despesas" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Nova Despesa</h1>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Data</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <CurrencyInput label="Valor" value={valor} onChange={setValor} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Área / Centro de custo</label>
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Categoria</label>
        <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaDespesa)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
          {CATEGORIAS_DESPESA.map(c => (
            <option key={c} value={c}>{CATEGORIA_DESPESA_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {isInvestimento(categoria) && (
        <div className="flex items-start gap-2 bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Investimento</strong> não entra no resultado operacional mensal. Aparecerá destacado nos relatórios.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Conta de origem</label>
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

      {/* Tutor (opcional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Tutor (opcional)</label>
        {tutorId ? (
          <div className="flex items-center gap-2 py-3 px-4 rounded-2xl bg-purple-50 border-2 border-brand-purple">
            <span className="text-sm font-semibold text-brand-purple flex-1">
              {tutores.find(t => t.id === tutorId)?.nome ?? tutorBusca}
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Fornecedor (opcional)</label>
        <input type="text" placeholder="Ex: Petshop XYZ" value={fornecedor} onChange={e => setFornecedor(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Descrição (opcional)</label>
        <input type="text" placeholder="Ex: Ração Premium 15kg" value={descricao} onChange={e => setDescricao(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

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

      {/* Recorrente */}
      <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4 border border-blue-200">
        <input type="checkbox" id="recorrente" checked={recorrente} onChange={e => setRecorrente(e.target.checked)}
          className="w-5 h-5 rounded accent-brand-purple" />
        <div>
          <label htmlFor="recorrente" className="text-sm font-semibold text-blue-800 cursor-pointer">
            Despesa recorrente (mensal)
          </label>
          <p className="text-xs text-blue-600">Gera pendência automaticamente todo mês</p>
        </div>
      </div>

      {recorrente && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Dia do vencimento</label>
          <input type="number" min="1" max="31" placeholder="Ex: 5" value={diaVencimento}
            onChange={e => setDiaVencimento(e.target.value)}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
        </div>
      )}

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button size="lg" variant="danger" onClick={salvar} loading={saving}>
        Salvar despesa
      </Button>
    </div>
  )
}
