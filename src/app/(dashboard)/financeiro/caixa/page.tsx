import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatCurrency, AREA_LABELS, CATEGORIA_RECEITA_LABELS, CATEGORIA_DESPESA_LABELS, FORMA_PAGAMENTO_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Receita, Despesa, FormaPagamento } from '@/types/financeiro'

export default async function CaixaDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>
}) {
  const { dia } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  const isAdmin = profile?.role === 'admin'

  // Dia selecionado (padrão: hoje no horário de Brasília)
  const hojeStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  const diaSel = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : hojeStr

  const [{ data: receitas }, { data: despesas }] = await Promise.all([
    supabase.from('receitas')
      .select('*, conta:contas_financeiras(nome), pet:pets(nome)')
      .eq('data', diaSel)
      .order('created_at', { ascending: false }),
    isAdmin
      ? supabase.from('despesas')
          .select('*, conta:contas_financeiras(nome)')
          .eq('data', diaSel)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const listaReceitas = (receitas ?? []) as Receita[]
  const listaDespesas = (despesas ?? []) as Despesa[]

  const totalReceitas = listaReceitas.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)
  const totalDespesas = listaDespesas.filter(d => d.status === 'pago').reduce((s, d) => s + d.valor, 0)
  const saldoDia = totalReceitas - totalDespesas

  // Recebimentos por forma de pagamento (fechamento de caixa)
  const porForma = new Map<FormaPagamento, number>()
  for (const r of listaReceitas) {
    if (r.status !== 'pago') continue
    porForma.set(r.forma_pagamento, (porForma.get(r.forma_pagamento) ?? 0) + (r.valor_liquido ?? r.valor))
  }

  // Navegação de dia
  const d = new Date(diaSel + 'T12:00:00')
  const diaAnterior = new Date(d); diaAnterior.setDate(d.getDate() - 1)
  const diaSeguinte = new Date(d); diaSeguinte.setDate(d.getDate() + 1)
  const fmt = (x: Date) => x.toISOString().split('T')[0]
  const nomeDia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const ehHoje = diaSel === hojeStr

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Caixa do Dia</h1>
      </div>

      {/* Navegação de dia */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3">
        <Link href={`?dia=${fmt(diaAnterior)}`} className="text-brand-purple font-bold text-lg px-2">‹</Link>
        <div className="text-center">
          <p className="font-semibold text-gray-800 capitalize text-sm">{nomeDia}</p>
          {ehHoje && <p className="text-[10px] text-brand-purple font-semibold">HOJE</p>}
        </div>
        <Link href={`?dia=${fmt(diaSeguinte)}`} className="text-brand-purple font-bold text-lg px-2">›</Link>
      </div>

      {/* Seletor de data */}
      <form action="/financeiro/caixa" method="GET" className="flex gap-2">
        <input
          type="date"
          name="dia"
          defaultValue={diaSel}
          className="flex-1 py-2.5 px-4 rounded-2xl border-2 border-gray-200 outline-none text-sm bg-white"
        />
        <button type="submit" className="px-5 py-2.5 rounded-2xl bg-brand-purple text-white font-semibold text-sm">
          Ir
        </button>
      </form>

      {/* Totais do dia */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center py-3">
          <TrendingUp size={16} className="text-green-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400">Entradas</p>
          <p className="font-bold text-sm text-green-600">{formatCurrency(totalReceitas)}</p>
        </Card>
        <Card className="text-center py-3">
          <TrendingDown size={16} className="text-red-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400">Saídas</p>
          <p className="font-bold text-sm text-red-600">{formatCurrency(totalDespesas)}</p>
        </Card>
        <Card className="text-center py-3">
          <Wallet size={16} className={`mx-auto mb-1 ${saldoDia >= 0 ? 'text-brand-purple' : 'text-red-500'}`} />
          <p className="text-[10px] text-gray-400">Saldo do dia</p>
          <p className={`font-bold text-sm ${saldoDia >= 0 ? 'text-brand-purple' : 'text-red-600'}`}>
            {formatCurrency(saldoDia)}
          </p>
        </Card>
      </div>

      {/* Recebido por forma de pagamento */}
      {porForma.size > 0 && (
        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recebido por forma de pagamento</p>
          <div className="flex flex-col gap-1.5">
            {[...porForma.entries()].map(([f, v]) => (
              <div key={f} className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{FORMA_PAGAMENTO_LABELS[f] ?? f}</p>
                <p className="font-bold text-sm text-gray-800">{formatCurrency(v)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Receitas do dia */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Receitas ({listaReceitas.length})
        </p>
        {listaReceitas.length === 0 ? (
          <Card className="text-center py-6 text-sm text-gray-400">Nenhuma receita neste dia</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {listaReceitas.map(r => (
              <Link key={r.id} href={`/financeiro/receitas/${r.id}`}>
                <Card className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[r.area]}`}>
                        {AREA_LABELS[r.area]}
                      </span>
                      {r.status === 'pendente' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700">Pendente</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.descricao || CATEGORIA_RECEITA_LABELS[r.categoria]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {FORMA_PAGAMENTO_LABELS[r.forma_pagamento]} · {r.conta?.nome}
                      {r.pet?.nome ? <> · <span className="text-brand-purple font-semibold">🐶 {r.pet.nome}</span></> : ''}
                    </p>
                  </div>
                  <p className="font-bold text-green-600 flex-shrink-0">+{formatCurrency(r.valor_liquido ?? r.valor)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Despesas do dia (admin) */}
      {isAdmin && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Despesas ({listaDespesas.length})
          </p>
          {listaDespesas.length === 0 ? (
            <Card className="text-center py-6 text-sm text-gray-400">Nenhuma despesa neste dia</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {listaDespesas.map(de => (
                <Link key={de.id} href={`/financeiro/despesas/${de.id}`}>
                  <Card className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[de.area]}`}>
                          {AREA_LABELS[de.area]}
                        </span>
                        {de.status === 'pendente' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700">Pendente</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {de.descricao || CATEGORIA_DESPESA_LABELS[de.categoria]}
                      </p>
                      <p className="text-xs text-gray-400">{de.conta?.nome}{de.fornecedor ? ` · ${de.fornecedor}` : ''}</p>
                    </div>
                    <p className="font-bold text-red-600 flex-shrink-0">−{formatCurrency(de.valor)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pb-6" />
    </div>
  )
}
