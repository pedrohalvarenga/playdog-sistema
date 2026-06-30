'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Repeat, Users, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import { formatCurrency, AREA_LABELS, CATEGORIA_DESPESA_LABELS, AREA_CORES } from '@/lib/financeiro'
import { formatDate } from '@/lib/utils'
import type { ContaFinanceira, Despesa } from '@/types/financeiro'
import { hojeLocal } from '@/lib/datas'

interface Funcionario {
  id: string
  nome: string
  cargo: string | null
  salario: number
  dia_pagamento: number | null
  ativo: boolean
}

interface PagamentoFunc {
  id: string
  data: string
  valor: number
  descricao: string | null
  funcionario_id: string
}

export default function RecorrentesPage() {
  const [loading, setLoading] = useState(true)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [pagamentosMes, setPagamentosMes] = useState<PagamentoFunc[]>([])
  const [recorrentes, setRecorrentes] = useState<Despesa[]>([])
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  // Modal pagamento
  const [pagandoFunc, setPagandoFunc] = useState<Funcionario | null>(null)
  const [valorPag, setValorPag] = useState(0)
  const [dataPag, setDataPag] = useState('')
  const [contaPag, setContaPag] = useState('')
  const [descPag, setDescPag] = useState('')
  const [salvandoPag, setSalvandoPag] = useState(false)

  // Modal funcionário (novo/editar)
  const [editFunc, setEditFunc] = useState<Partial<Funcionario> | null>(null)
  const [salvandoFunc, setSalvandoFunc] = useState(false)

  const hoje = new Date()
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const [f, p, r, c] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('ativo', true).order('nome'),
      supabase.from('despesas').select('id, data, valor, descricao, funcionario_id')
        .eq('mes_referencia', mesRef).not('funcionario_id', 'is', null),
      supabase.from('despesas').select('*, conta:contas_financeiras(nome)')
        .eq('recorrente', true).order('data', { ascending: false }).limit(100),
      supabase.from('contas_financeiras').select('*').eq('ativo', true),
    ])
    setFuncionarios((f.data as Funcionario[]) ?? [])
    setPagamentosMes((p.data as PagamentoFunc[]) ?? [])
    setRecorrentes((r.data as Despesa[]) ?? [])
    setContas((c.data as ContaFinanceira[]) ?? [])
    setLoading(false)
  }, [mesRef])

  useEffect(() => { carregar() }, [carregar])

  function pagoNoMes(funcId: string) {
    return pagamentosMes.filter(p => p.funcionario_id === funcId).reduce((s, p) => s + p.valor, 0)
  }

  function abrirPagamento(f: Funcionario, sugestao?: number) {
    const restante = Math.max(0, f.salario - pagoNoMes(f.id))
    setPagandoFunc(f)
    setValorPag(sugestao ?? restante)
    setDataPag(hojeLocal())
    setContaPag(contas[0]?.id ?? '')
    setDescPag('')
  }

  async function salvarPagamento() {
    if (!pagandoFunc || valorPag <= 0 || !contaPag) return
    setSalvandoPag(true)
    const supabase = createClient()
    const { error } = await supabase.from('despesas').insert({
      data: dataPag,
      valor: valorPag,
      area: 'geral',
      categoria: 'salarios',
      conta_id: contaPag,
      descricao: descPag || `Salário ${pagandoFunc.nome}`,
      status: 'pago',
      data_pagamento: dataPag, // regime de caixa: saiu na data do pagamento
      recorrente: false,
      funcionario_id: pagandoFunc.id,
      mes_referencia: mesRef,
    })
    setSalvandoPag(false)
    if (error) { alert(`Erro: ${error.message}`); return }
    setPagandoFunc(null)
    carregar()
  }

  async function salvarFuncionario() {
    if (!editFunc?.nome) { alert('Informe o nome.'); return }
    setSalvandoFunc(true)
    const supabase = createClient()
    const dados = {
      nome: editFunc.nome,
      cargo: editFunc.cargo || null,
      salario: editFunc.salario ?? 0,
      dia_pagamento: editFunc.dia_pagamento || null,
    }
    const { error } = editFunc.id
      ? await supabase.from('funcionarios').update(dados).eq('id', editFunc.id)
      : await supabase.from('funcionarios').insert({ ...dados, ativo: true })
    setSalvandoFunc(false)
    if (error) { alert(`Erro: ${error.message}`); return }
    setEditFunc(null)
    carregar()
  }

  async function desativarFuncionario(f: Funcionario) {
    if (!confirm(`Desativar ${f.nome}? O histórico de pagamentos será mantido.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('funcionarios').update({ ativo: false }).eq('id', f.id)
    if (error) { alert(`Erro ao desativar: ${error.message}`); return }
    setEditFunc(null)
    carregar()
  }

  // Agrupa despesas recorrentes (uma linha por descricao+categoria, ocorrência mais recente)
  const gruposRecorrentes: Despesa[] = []
  const vistos = new Set<string>()
  for (const d of recorrentes) {
    const chave = `${(d.descricao ?? '').toLowerCase().trim()}|${d.categoria}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    gruposRecorrentes.push(d)
  }

  // ===== Resumo do mês =====
  const totalSalarios = funcionarios.reduce((s, f) => s + f.salario, 0)
  const totalRecorrentesEstimado = gruposRecorrentes.reduce((s, d) => s + d.valor, 0)
  const custoFixoMensal = totalSalarios + totalRecorrentesEstimado

  const salariosPagos = funcionarios.reduce((s, f) => s + Math.min(pagoNoMes(f.id), f.salario), 0)
  const salariosFaltam = Math.max(0, totalSalarios - salariosPagos)

  // Ocorrências de despesas recorrentes dentro do mês atual
  const recorrentesDoMes = recorrentes.filter(d => (d.data ?? '').startsWith(mesRef) || (d.data_vencimento ?? '').startsWith(mesRef))
  const recPagas = recorrentesDoMes.filter(d => d.status === 'pago').reduce((s, d) => s + d.valor, 0)
  const recPendentes = recorrentesDoMes.filter(d => d.status === 'pendente').reduce((s, d) => s + d.valor, 0)

  const totalPago = salariosPagos + recPagas
  const totalFalta = salariosFaltam + recPendentes

  if (loading) return <div className="py-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Recorrentes & Salários</h1>
      </div>

      {/* ===== RESUMO DO MÊS ===== */}
      <Card className="bg-gradient-to-br from-brand-purple to-purple-700 text-white border-0">
        <p className="text-xs opacity-80">Custo fixo mensal (salários + recorrentes)</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(custoFixoMensal)}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-white/15 rounded-xl px-3 py-2">
            <p className="text-[10px] opacity-80">Já pago em <span className="capitalize">{nomeMes.split(' ')[0]}</span></p>
            <p className="font-bold text-lg text-green-300">{formatCurrency(totalPago)}</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2">
            <p className="text-[10px] opacity-80">Falta pagar</p>
            <p className={`font-bold text-lg ${totalFalta > 0 ? 'text-yellow-300' : 'text-green-300'}`}>
              {totalFalta > 0 ? formatCurrency(totalFalta) : 'Tudo pago ✓'}
            </p>
          </div>
        </div>
      </Card>

      {/* ===== FUNCIONÁRIOS ===== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={14} /> Funcionários — <span className="capitalize">{nomeMes}</span>
          </p>
          <button onClick={() => setEditFunc({})} className="text-xs text-brand-purple font-semibold flex items-center gap-1">
            <Plus size={14} /> Novo
          </button>
        </div>

        {funcionarios.length === 0 ? (
          <Card className="text-center py-6 text-sm text-gray-400">Nenhum funcionário cadastrado</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {funcionarios.map(f => {
              const pago = pagoNoMes(f.id)
              const restante = Math.max(0, f.salario - pago)
              const quitado = restante === 0 && f.salario > 0
              const pagamentos = pagamentosMes.filter(p => p.funcionario_id === f.id)
              const aberto = expandido === f.id
              return (
                <Card key={f.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{f.nome}</p>
                        {quitado && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">Pago ✓</span>
                        )}
                        {pago > 0 && !quitado && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700">Parcial</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {f.cargo ? `${f.cargo} · ` : ''}Salário {formatCurrency(f.salario)}
                        {f.dia_pagamento ? ` · paga dia ${f.dia_pagamento}` : ''}
                      </p>
                    </div>
                    <button onClick={() => setEditFunc(f)} className="p-2 text-gray-300 hover:text-gray-500">
                      <Pencil size={15} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-[10px] text-gray-400">Pago no mês</p>
                      <p className="font-bold text-sm text-green-600">{formatCurrency(pago)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Restante</p>
                      <p className={`font-bold text-sm ${restante > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCurrency(restante)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!quitado && (
                      <button
                        onClick={() => abrirPagamento(f)}
                        className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white font-semibold text-sm"
                      >
                        {pago > 0 ? `Pagar restante (${formatCurrency(restante)})` : 'Registrar pagamento'}
                      </button>
                    )}
                    <button
                      onClick={() => abrirPagamento(f, 0)}
                      className="flex-1 py-2.5 rounded-xl bg-purple-50 text-brand-purple font-semibold text-sm"
                    >
                      Adiantamento / parcial
                    </button>
                  </div>

                  {pagamentos.length > 0 && (
                    <button
                      onClick={() => setExpandido(aberto ? null : f.id)}
                      className="flex items-center justify-center gap-1 text-xs text-gray-400 font-medium"
                    >
                      {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {pagamentos.length} pagamento{pagamentos.length > 1 ? 's' : ''} neste mês
                    </button>
                  )}
                  {aberto && (
                    <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
                      {pagamentos.map(p => (
                        <Link key={p.id} href={`/financeiro/despesas/${p.id}`} className="flex items-center justify-between text-sm py-1">
                          <span className="text-gray-600">{formatDate(p.data)} · {p.descricao}</span>
                          <span className="font-semibold text-gray-800">{formatCurrency(p.valor)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== DESPESAS RECORRENTES ===== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Repeat size={14} /> Despesas recorrentes
          </p>
          <Link href="/financeiro/despesas/nova" className="text-xs text-brand-purple font-semibold flex items-center gap-1">
            <Plus size={14} /> Nova despesa
          </Link>
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Despesas marcadas como recorrentes geram automaticamente uma pendência todo mês no dia do vencimento.
        </p>

        {gruposRecorrentes.length === 0 ? (
          <Card className="text-center py-6 text-sm text-gray-400">
            Nenhuma despesa recorrente. Marque &quot;Despesa recorrente (mensal)&quot; ao lançar uma despesa.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {gruposRecorrentes.map(d => (
              <Link key={d.id} href={`/financeiro/despesas/${d.id}`}>
                <Card className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[d.area]}`}>
                        {AREA_LABELS[d.area]}
                      </span>
                      {d.dia_vencimento && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                          todo dia {d.dia_vencimento}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {d.descricao || CATEGORIA_DESPESA_LABELS[d.categoria]}
                    </p>
                    <p className="text-xs text-gray-400">Último: {formatDate(d.data)} · {d.conta?.nome}</p>
                  </div>
                  <p className="font-bold text-red-600 flex-shrink-0">−{formatCurrency(d.valor)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL PAGAMENTO ===== */}
      {pagandoFunc && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setPagandoFunc(null)}>
          <div className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Pagamento — {pagandoFunc.nome}</h2>
              <button onClick={() => setPagandoFunc(null)} className="p-2 rounded-xl text-gray-400"><X size={22} /></button>
            </div>

            <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500">
              Salário {formatCurrency(pagandoFunc.salario)} · já pago {formatCurrency(pagoNoMes(pagandoFunc.id))} ·
              restante <strong className="text-gray-700">{formatCurrency(Math.max(0, pagandoFunc.salario - pagoNoMes(pagandoFunc.id)))}</strong>
            </div>

            <CurrencyInput label="Valor a pagar" value={valorPag} onChange={setValorPag} autoFocus />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Data</label>
              <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Conta de origem</label>
              <div className="flex flex-col gap-2">
                {contas.map(c => (
                  <button key={c.id} type="button" onClick={() => setContaPag(c.id)}
                    className={`py-2.5 px-4 rounded-2xl text-sm font-semibold border-2 text-left ${
                      contaPag === c.id ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
                    }`}>
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Descrição (opcional)</label>
              <input type="text" value={descPag} onChange={e => setDescPag(e.target.value)}
                placeholder={`Ex: Adiantamento ${pagandoFunc.nome}`}
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <Button size="lg" onClick={salvarPagamento} loading={salvandoPag}>
              Confirmar pagamento
            </Button>
          </div>
        </div>
      )}

      {/* ===== MODAL FUNCIONÁRIO ===== */}
      {editFunc && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setEditFunc(null)}>
          <div className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">{editFunc.id ? 'Editar funcionário' : 'Novo funcionário'}</h2>
              <button onClick={() => setEditFunc(null)} className="p-2 rounded-xl text-gray-400"><X size={22} /></button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Nome *</label>
              <input type="text" value={editFunc.nome ?? ''} onChange={e => setEditFunc({ ...editFunc, nome: e.target.value })}
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Cargo</label>
              <input type="text" value={editFunc.cargo ?? ''} onChange={e => setEditFunc({ ...editFunc, cargo: e.target.value })}
                placeholder="Ex: Recepção, Banho & Tosa..."
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <CurrencyInput label="Salário mensal" value={editFunc.salario ?? 0} onChange={v => setEditFunc({ ...editFunc, salario: v })} />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Dia do pagamento</label>
              <input type="number" min="1" max="31" value={editFunc.dia_pagamento ?? ''}
                onChange={e => setEditFunc({ ...editFunc, dia_pagamento: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                placeholder="Ex: 5"
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>

            <Button size="lg" onClick={salvarFuncionario} loading={salvandoFunc}>
              {editFunc.id ? 'Salvar alterações' : 'Cadastrar funcionário'}
            </Button>
            {editFunc.id && (
              <button onClick={() => desativarFuncionario(editFunc as Funcionario)} className="text-sm text-red-500 font-semibold py-1">
                Desativar funcionário
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pb-6" />
    </div>
  )
}
