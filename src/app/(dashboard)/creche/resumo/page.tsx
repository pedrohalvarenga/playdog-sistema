'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, AlertCircle, CheckCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const FORMA_LABELS: Record<string, string> = {
  pix_pagbank: 'Pix PagBank',
  pix_c6: 'Pix C6',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
}

interface ResumoMes {
  totalDiariasVendidas: number
  totalRecebido: number
  totalDiariasUsadas: number
  porForma: Record<string, { diarias: number; valor: number }>
}

interface ResumoSaldo {
  negativos: number
  diariasDevedoras: number
  valorEstimado: number
  positivos: number
  diariasPrePagas: number
}

export default function ResumoFinanceiroPage() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [loading, setLoading] = useState(true)
  const [resumoMes, setResumoMes] = useState<ResumoMes | null>(null)
  const [resumoSaldo, setResumoSaldo] = useState<ResumoSaldo | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fim = new Date(ano, mes, 0).toISOString().split('T')[0]

      const [{ data: compras }, { data: presencas }, { data: pets }, { data: precos }] = await Promise.all([
        supabase.from('compras_diarias').select('quantidade, valor_pago, forma_pagamento').gte('data', inicio).lte('data', fim),
        supabase.from('presencas').select('id').gte('data', inicio).lte('data', fim),
        supabase.from('pets').select('saldo_diarias').eq('ativo', true),
        supabase.from('precos_padrao').select('plano, valor').eq('plano', 'diaria_avulsa').single(),
      ])

      // Resumo do mês
      const porForma: Record<string, { diarias: number; valor: number }> = {}
      let totalDiariasVendidas = 0
      let totalRecebido = 0
      for (const c of compras ?? []) {
        totalDiariasVendidas += c.quantidade
        totalRecebido += c.valor_pago ?? 0
        if (!porForma[c.forma_pagamento]) porForma[c.forma_pagamento] = { diarias: 0, valor: 0 }
        porForma[c.forma_pagamento].diarias += c.quantidade
        porForma[c.forma_pagamento].valor += c.valor_pago ?? 0
      }

      setResumoMes({
        totalDiariasVendidas,
        totalRecebido,
        totalDiariasUsadas: presencas?.length ?? 0,
        porForma,
      })

      // Resumo de saldos (todos os pets ativos)
      const precoPadrao = (precos as { valor: number } | null)?.valor ?? 0
      let negativos = 0, diariasDevedoras = 0, valorEstimado = 0
      let positivos = 0, diariasPrePagas = 0
      for (const p of pets ?? []) {
        if (p.saldo_diarias < 0) {
          negativos++
          diariasDevedoras += Math.abs(p.saldo_diarias)
          valorEstimado += Math.abs(p.saldo_diarias) * precoPadrao
        } else if (p.saldo_diarias > 0) {
          positivos++
          diariasPrePagas += p.saldo_diarias
        }
      }

      setResumoSaldo({ negativos, diariasDevedoras, valorEstimado, positivos, diariasPrePagas })
      setLoading(false)
    }
    load()
  }, [mes, ano])

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resumo Financeiro</h1>
          <p className="text-sm text-gray-400">Creche — diárias e cobranças</p>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="flex gap-2">
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          className="flex-1 px-3 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
          {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          className="px-3 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ──── RECEBIDO NO MÊS ──── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TrendingUp size={13} /> Recebido em {MESES[mes]}/{ano}
            </h2>

            {/* Cards principais */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-brand-purple rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{resumoMes?.totalDiariasVendidas ?? 0}</p>
                <p className="text-xs opacity-80 mt-1">Diárias vendidas</p>
              </div>
              <div className="bg-green-500 rounded-2xl p-4 text-white text-center">
                <p className="text-xl font-bold">
                  R$ {(resumoMes?.totalRecebido ?? 0).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs opacity-80 mt-1">Total recebido</p>
              </div>
            </div>

            {/* Diárias usadas no período */}
            <div className="bg-gray-100 rounded-2xl p-3 flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={16} />
                <span className="text-sm font-semibold">Presenças no período</span>
              </div>
              <span className="text-xl font-bold text-gray-800">{resumoMes?.totalDiariasUsadas ?? 0}</span>
            </div>

            {/* Por forma de pagamento */}
            {resumoMes && Object.keys(resumoMes.porForma).length > 0 && (
              <Card>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por forma de pagamento</p>
                <div className="flex flex-col gap-2">
                  {Object.entries(resumoMes.porForma)
                    .sort((a, b) => b[1].valor - a[1].valor)
                    .map(([forma, dados]) => (
                      <div key={forma} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-brand-purple" />
                          <span className="text-sm text-gray-700">{FORMA_LABELS[forma] ?? forma}</span>
                          <span className="text-xs text-gray-400">({dados.diarias}d)</span>
                        </div>
                        <span className="font-semibold text-sm text-gray-900">
                          R$ {dados.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span className="text-green-600">R$ {(resumoMes.totalRecebido).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </Card>
            )}

            {resumoMes?.totalDiariasVendidas === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">Nenhuma diária vendida em {MESES[mes]}/{ano}</p>
            )}
          </div>

          {/* ──── A COBRAR (saldos) ──── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertCircle size={13} /> Situação atual dos saldos
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {/* Negativos */}
              <Link href="/creche/cobranca" className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center active:bg-red-100">
                <p className="text-3xl font-bold text-red-600">{resumoSaldo?.negativos ?? 0}</p>
                <p className="text-xs text-red-500 mt-1">Pet{(resumoSaldo?.negativos ?? 0) !== 1 ? 's' : ''} no negativo</p>
                <p className="text-sm font-bold text-red-700 mt-2">
                  {resumoSaldo?.diariasDevedoras ?? 0}d devidas
                </p>
                {(resumoSaldo?.valorEstimado ?? 0) > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">
                    ≈ R$ {(resumoSaldo?.valorEstimado ?? 0).toFixed(2).replace('.', ',')}
                  </p>
                )}
                <p className="text-xs text-red-400 mt-2 font-semibold">Ver cobrança →</p>
              </Link>

              {/* Positivos (crédito) */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{resumoSaldo?.positivos ?? 0}</p>
                <p className="text-xs text-green-500 mt-1">Pet{(resumoSaldo?.positivos ?? 0) !== 1 ? 's' : ''} com crédito</p>
                <p className="text-sm font-bold text-green-700 mt-2">
                  {resumoSaldo?.diariasPrePagas ?? 0}d pré-pagas
                </p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <CheckCircle size={12} className="text-green-400" />
                  <p className="text-xs text-green-400 font-semibold">Em dia</p>
                </div>
              </div>
            </div>

            {(resumoSaldo?.valorEstimado ?? 0) > 0 && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-orange-800">Total estimado a cobrar</p>
                  <p className="text-xs text-orange-500">Com base no preço padrão da diária</p>
                </div>
                <p className="text-xl font-bold text-orange-700">
                  R$ {(resumoSaldo?.valorEstimado ?? 0).toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
