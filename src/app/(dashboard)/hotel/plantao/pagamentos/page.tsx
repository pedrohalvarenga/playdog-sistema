'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Moon, CheckCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import type { Plantonista, EscalaPlantao } from '@/types/hotel'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface PagamentoPlantonista {
  plantonista: Plantonista
  noites: EscalaPlantao[]
  totalNoites: number
  totalValor: number
  status: 'pendente' | 'pago'
  dataPagamento?: string
  formaPagamento?: string
}

export default function PagamentosPage() {
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const [dados, setDados] = useState<PagamentoPlantonista[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  // Modal marcar como pago
  const [modalPlan, setModalPlan] = useState<PagamentoPlantonista | null>(null)
  const [formaPag, setFormaPag] = useState('pix')
  const [dataPag, setDataPag] = useState(() => new Date().toISOString().split('T')[0])

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const inicio = new Date(mes.ano, mes.mes, 1).toISOString().split('T')[0]
    const fim = new Date(mes.ano, mes.mes + 1, 0).toISOString().split('T')[0]

    const [{ data: plan }, { data: esc }] = await Promise.all([
      supabase.from('plantonistas').select('*').eq('ativo', true).order('nome'),
      supabase.from('escala_plantao')
        .select('*, plantonista:plantonistas(nome, valor_noite)')
        .gte('data', inicio)
        .lte('data', fim)
        .not('plantonista_id', 'is', null),
    ])

    const plantonistas = (plan as Plantonista[]) ?? []
    const escalas = (esc as EscalaPlantao[]) ?? []

    // Busca pagamentos registrados para este mês
    const { data: pagReg } = await supabase
      .from('config_hotel')
      .select('chave, valor')
      .like('chave', `pag_${mes.ano}_${String(mes.mes + 1).padStart(2, '0')}_%`)

    const pagMap: Record<string, { status: string; data_pagamento?: string; forma?: string }> = {}
    ;(pagReg ?? []).forEach(r => {
      try { pagMap[r.chave] = JSON.parse(r.valor) } catch {}
    })

    const resultado: PagamentoPlantonista[] = plantonistas.map(p => {
      const noitesDoMes = escalas.filter(e => e.plantonista_id === p.id)
      const totalValor = noitesDoMes.reduce((acc, e) => acc + (e.valor_noite ?? p.valor_noite), 0)
      const chave = `pag_${mes.ano}_${String(mes.mes + 1).padStart(2, '0')}_${p.id}`
      const reg = pagMap[chave]
      return {
        plantonista: p,
        noites: noitesDoMes,
        totalNoites: noitesDoMes.length,
        totalValor,
        status: (reg?.status as 'pendente' | 'pago') ?? 'pendente',
        dataPagamento: reg?.data_pagamento,
        formaPagamento: reg?.forma,
      }
    }).filter(d => d.totalNoites > 0)

    setDados(resultado)
    setLoading(false)
  }, [mes])

  useEffect(() => { carregar() }, [carregar])

  async function marcarPago(item: PagamentoPlantonista) {
    setMarcando(item.plantonista.id)
    const supabase = createClient()
    const chave = `pag_${mes.ano}_${String(mes.mes + 1).padStart(2, '0')}_${item.plantonista.id}`
    const valor = JSON.stringify({
      status: 'pago',
      data_pagamento: dataPag,
      forma: formaPag,
      plantonista_nome: item.plantonista.nome,
      total_noites: item.totalNoites,
      total_valor: item.totalValor,
    })
    await supabase.from('config_hotel').upsert({ chave, valor })
    setModalPlan(null)
    setMarcando(null)
    await carregar()
  }

  function prevMes() { setMes(m => m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ano: m.ano, mes: m.mes - 1 }) }
  function nextMes() { setMes(m => m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ano: m.ano, mes: m.mes + 1 }) }

  const totalMes = dados.reduce((acc, d) => acc + d.totalValor, 0)
  const totalPago = dados.filter(d => d.status === 'pago').reduce((acc, d) => acc + d.totalValor, 0)
  const totalPendente = totalMes - totalPago

  return (
    <div className="py-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-gray-900">Pagamentos de Plantão</h1>

      {/* Navegação mensal */}
      <div className="flex items-center justify-between">
        <button onClick={prevMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-900">{MESES[mes.mes]} {mes.ano}</p>
        <button onClick={nextMes} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Resumo do mês */}
      {dados.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-100 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-gray-800">R$ {totalMes.toFixed(2).replace('.', ',')}</p>
            <p className="text-xs text-gray-500">Total do mês</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-green-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
            <p className="text-xs text-green-400">Pago</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-brand-orange">R$ {totalPendente.toFixed(2).replace('.', ',')}</p>
            <p className="text-xs text-orange-400">Pendente</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : dados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Moon size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma escala neste mês</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dados.map(item => (
            <Card key={item.plantonista.id}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Moon size={22} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{item.plantonista.nome}</p>
                  <p className="text-xs text-gray-500">{item.totalNoites} noite{item.totalNoites !== 1 ? 's' : ''}</p>
                  {item.status === 'pago' && item.dataPagamento && (
                    <p className="text-xs text-green-600">Pago em {item.dataPagamento} · {item.formaPagamento?.toUpperCase()}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">R$ {item.totalValor.toFixed(2).replace('.', ',')}</p>
                  {item.status === 'pago' ? (
                    <span className="text-[10px] text-green-600 flex items-center gap-0.5 justify-end">
                      <CheckCircle size={10} /> Pago
                    </span>
                  ) : (
                    <button
                      onClick={() => { setModalPlan(item); setFormaPag('pix'); setDataPag(new Date().toISOString().split('T')[0]) }}
                      className="text-[10px] bg-brand-purple text-white px-2 py-0.5 rounded-full font-semibold"
                    >
                      Marcar pago
                    </button>
                  )}
                </div>
              </div>

              {/* Detalhe noites */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1">
                {item.noites.slice(0, 10).map(n => (
                  <span key={n.id} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">
                    {new Date(n.data + 'T12:00:00').getDate()}/{String(mes.mes + 1).padStart(2,'0')}
                  </span>
                ))}
                {item.noites.length > 10 && (
                  <span className="text-[10px] text-gray-400">+{item.noites.length - 10}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal marcar como pago */}
      {modalPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Marcar como pago</h2>
            <p className="text-gray-600">{modalPlan.plantonista.nome} — {modalPlan.totalNoites} noite{modalPlan.totalNoites !== 1 ? 's' : ''}</p>
            <p className="text-2xl font-bold text-brand-purple text-center">R$ {modalPlan.totalValor.toFixed(2).replace('.', ',')}</p>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data do pagamento</label>
              <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Forma de pagamento</label>
              <select value={formaPag} onChange={e => setFormaPag(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModalPlan(null)} className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold">
                Cancelar
              </button>
              <button
                onClick={() => marcarPago(modalPlan)}
                disabled={!!marcando}
                className="py-3 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50"
              >
                {marcando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
