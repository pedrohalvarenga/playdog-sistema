'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer, Send, Dog, Wallet, ShoppingBag, CalendarCheck, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Tutor, Pet } from '@/types'
import { diaLocal } from '@/lib/datas'
import { montarContaCorrente, type MovimentoExtrato } from '@/lib/extrato'

interface PetExtrato {
  pet: Pet
  saldoAnterior: number
  movimentos: MovimentoExtrato[]
  saldoFinal: number
  totalPago: number
  presencasCount: number
}

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Inclui as formas da creche (pix_pagbank...) e as do Financeiro (pix, credito...)
const FORMA_LABELS: Record<string, string> = {
  pix: 'Pix', pix_pagbank: 'Pix PagBank', pix_c6: 'Pix C6',
  dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito',
}

function fmtMoeda(v: number) {
  return 'R$ ' + v.toFixed(2).replace('.', ',')
}
function saldoCor(s: number) {
  return s < 0 ? 'text-red-600' : s > 0 ? 'text-green-600' : 'text-gray-500'
}
function saldoLabel(s: number) {
  return `${s} diária${Math.abs(s) !== 1 ? 's' : ''}`
}

export default function ExtratoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tutorId = params.tutorId as string

  const hoje = new Date()
  const [mes, setMes] = useState(Number(searchParams.get('mes')) || hoje.getMonth() + 1)
  const [ano, setAno] = useState(Number(searchParams.get('ano')) || hoje.getFullYear())

  const [tutor, setTutor] = useState<Tutor | null>(null)
  const [petsExtrato, setPetsExtrato] = useState<PetExtrato[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fim = diaLocal(new Date(ano, mes, 0))
      const fimExclusivo = diaLocal(new Date(ano, mes, 1)) // 1º dia do mês seguinte

      const [{ data: tutorData }, { data: pets }] = await Promise.all([
        supabase.from('tutores').select('*').eq('id', tutorId).single(),
        supabase.from('pets').select('*').eq('tutor_id', tutorId).eq('ativo', true),
      ])

      setTutor(tutorData)
      if (!pets || pets.length === 0) { setPetsExtrato([]); setLoading(false); return }
      const petIds = pets.map(p => p.id)

      // Busca tudo a partir do início do mês selecionado (inclui o mês e o que veio depois).
      // O saldo anterior é ANCORADO no saldo_diarias real (fonte da verdade):
      //   saldo_anterior = saldo_atual − (movimentos do início do mês até agora).
      // Assim o extrato sempre fecha com o saldo verdadeiro, mesmo com histórico antigo.
      const [{ data: receitas }, { data: comprasFree }, { data: presencas }, { data: ajustes }] = await Promise.all([
        supabase.from('receitas')
          .select('pet_id, data, valor, forma_pagamento, num_diarias, created_at')
          .in('pet_id', petIds).eq('area', 'creche').eq('status', 'pago')
          .not('num_diarias', 'is', null).gte('data', inicio).order('data'),
        supabase.from('compras_diarias')
          .select('pet_id, data, quantidade, forma_pagamento, created_at')
          .in('pet_id', petIds).eq('valor_pago', 0).gte('data', inicio).order('data'),
        supabase.from('presencas')
          .select('pet_id, data, created_at').in('pet_id', petIds).gte('data', inicio).order('data'),
        supabase.from('ajustes_saldo')
          .select('pet_id, quantidade, motivo, created_at').in('pet_id', petIds).gte('created_at', inicio),
      ])

      const resultado: PetExtrato[] = pets.map(pet => {
        const saldoLive = (pet as Pet).saldo_diarias ?? 0

        // Créditos = receitas pagas (pacote pago) + compras de cortesia (valor 0)
        const pReceitas = (receitas ?? []).filter(r => r.pet_id === pet.id)
        const pFree = (comprasFree ?? []).filter(c => c.pet_id === pet.id)
        const pPresencas = (presencas ?? []).filter(p => p.pet_id === pet.id)
        const pAjustes = (ajustes ?? []).filter(a => a.pet_id === pet.id)

        // Net desde o início do mês até agora (para ancorar o saldo anterior)
        const creditosDesde = pReceitas.reduce((s, r) => s + (r.num_diarias ?? 0), 0)
          + pFree.reduce((s, c) => s + c.quantidade, 0)
        const netDesde = creditosDesde - pPresencas.length + pAjustes.reduce((s, a) => s + a.quantidade, 0)
        const saldoAnterior = saldoLive - netDesde

        // Movimentos DENTRO do mês (para exibir)
        const comprasMes = [
          ...pReceitas.filter(r => r.data <= fim).map(r => ({
            data: r.data, quantidade: r.num_diarias ?? 0, valor_pago: r.valor,
            forma_pagamento: r.forma_pagamento, created_at: r.created_at,
          })),
          ...pFree.filter(c => c.data <= fim).map(c => ({
            data: c.data, quantidade: c.quantidade, valor_pago: 0,
            forma_pagamento: c.forma_pagamento, created_at: c.created_at,
          })),
        ]
        const presencasMes = pPresencas.filter(p => p.data <= fim)
        const ajustesMes = pAjustes.filter(a => a.created_at < fimExclusivo)

        const { movimentos, saldoFinal } = montarContaCorrente({
          saldoAnterior, compras: comprasMes, presencas: presencasMes, ajustes: ajustesMes,
        })

        return {
          pet: pet as Pet,
          saldoAnterior,
          movimentos,
          saldoFinal,
          totalPago: comprasMes.reduce((s, c) => s + c.valor_pago, 0),
          presencasCount: presencasMes.length,
        }
      }).filter(e => e.movimentos.length > 0 || e.saldoFinal !== 0)

      setPetsExtrato(resultado)
      setLoading(false)
    }
    load()
  }, [tutorId, mes, ano])

  async function enviarEmail() {
    if (!tutor?.email) { alert('Tutor não tem e-mail cadastrado. Cadastre em Editar Tutor.'); return }
    setEnviando(true)
    const res = await fetch('/api/email/enviar-extrato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_id: tutorId, mes, ano }),
    })
    if (res.ok) {
      alert('Extrato enviado com sucesso!')
    } else {
      const err = await res.json()
      alert(err.error ?? 'Erro ao enviar e-mail')
    }
    setEnviando(false)
  }

  const saldoTotal = petsExtrato.reduce((s, e) => s + e.saldoFinal, 0)
  const totalPresencas = petsExtrato.reduce((s, e) => s + e.presencasCount, 0)
  const totalPago = petsExtrato.reduce((s, e) => s + e.totalPago, 0)
  const mesAtual = mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { margin: 0; padding: 16px; }
        }
      `}</style>

      <div className="py-6 flex flex-col gap-4 print-page">
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/creche/cobranca" className="p-2 rounded-xl text-gray-400">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Extrato</h1>
          </div>
          <Link href="/creche/envio-lote" className="text-xs text-brand-purple font-semibold">
            Envio em lote
          </Link>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold">
              <Printer size={16} /> PDF
            </button>
            <button onClick={enviarEmail} disabled={enviando}
              className="flex items-center gap-1.5 bg-brand-purple text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
              <Send size={16} /> {enviando ? 'Enviando...' : 'Enviar e-mail'}
            </button>
          </div>
        </div>

        {/* Seletor de período */}
        <div className="no-print flex gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="bg-brand-purple rounded-3xl p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs opacity-70 uppercase tracking-wide font-semibold">Play Dog</p>
                  <h2 className="text-xl font-bold">Extrato Mensal</h2>
                  <p className="text-white/80">{MESES[mes]} / {ano}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Tutor</p>
                  <p className="font-bold">{tutor?.nome}</p>
                  {tutor?.email && <p className="text-sm opacity-80">{tutor.email}</p>}
                </div>
              </div>

              {/* Saldo em destaque */}
              <div className="bg-white/15 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={16} className="opacity-80" />
                  <p className="text-xs opacity-80">
                    {mesAtual ? 'Saldo atual de diárias' : `Saldo em ${MESES[mes]}/${ano}`}
                  </p>
                </div>
                <p className="text-3xl font-bold">
                  {saldoTotal >= 0 ? saldoLabel(saldoTotal) : `${saldoLabel(Math.abs(saldoTotal))} a pagar`}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  {saldoTotal < 0 ? 'Saldo negativo — diárias usadas além do pacote pago.'
                    : saldoTotal > 0 ? 'Diárias pagas e ainda não usadas.'
                    : 'Conta zerada.'}
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-bold">{totalPresencas}</p>
                  <p className="text-xs opacity-80">Presenças no mês</p>
                </div>
                {totalPago > 0 && (
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-lg font-bold">{fmtMoeda(totalPago)}</p>
                    <p className="text-xs opacity-80">Pago no mês</p>
                  </div>
                )}
              </div>
            </div>

            {petsExtrato.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Dog size={40} className="mx-auto mb-2 opacity-30" />
                <p>Sem movimentações em {MESES[mes]}/{ano}</p>
              </div>
            ) : (
              petsExtrato.map(e => <PetContaCorrente key={e.pet.id} extrato={e} mes={mes} />)
            )}

            <p className="text-[11px] text-gray-400 text-center px-4 mt-1">
              Conta corrente de diárias: cada presença usa 1 diária; cada pacote pago adiciona diárias.
              O saldo acumulado aparece à direita de cada linha.
            </p>
          </>
        )}
      </div>
    </>
  )
}

function PetContaCorrente({ extrato, mes }: { extrato: PetExtrato; mes: number }) {
  const { pet, saldoAnterior, movimentos, saldoFinal } = extrato

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Cabeçalho do pet */}
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
        <Dog size={18} className="text-brand-purple" />
        <div>
          <p className="font-bold text-gray-900">{pet.nome}</p>
          {pet.identificador && <p className="text-xs text-gray-400">{pet.identificador}</p>}
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo final</p>
          <span className={`text-base font-bold ${saldoCor(saldoFinal)}`}>{saldoLabel(saldoFinal)}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Saldo anterior */}
        <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
          <span className="text-gray-500">Saldo anterior</span>
          <span className={`font-semibold ${saldoCor(saldoAnterior)}`}>{saldoLabel(saldoAnterior)}</span>
        </div>

        {/* Movimentos */}
        <div className="flex flex-col">
          {movimentos.map((m, i) => <LinhaMovimento key={i} mov={m} />)}
        </div>

        {/* Saldo final */}
        <div className="flex items-center justify-between text-sm py-2.5 border-t-2 border-gray-200 mt-1">
          <span className="font-bold text-gray-800">Saldo no fim de {MESES[mes]}</span>
          <span className={`font-bold text-base ${saldoCor(saldoFinal)}`}>{saldoLabel(saldoFinal)}</span>
        </div>
      </div>
    </div>
  )
}

function LinhaMovimento({ mov }: { mov: MovimentoExtrato }) {
  const isCredito = mov.tipo === 'compra'
  const isAjuste = mov.tipo === 'ajuste'
  const isCortesia = isCredito && (mov.valorPago ?? 0) === 0
  const deltaCor = mov.dias > 0 ? 'text-green-600' : 'text-red-500'

  const Icone = isCredito ? ShoppingBag : isAjuste ? Settings2 : CalendarCheck
  const iconeCor = isCredito ? 'text-green-600' : isAjuste ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className={`flex items-center gap-2 py-2 border-b border-gray-50 ${isCredito ? 'bg-green-50/50 -mx-4 px-4' : ''}`}>
      <Icone size={15} className={`${iconeCor} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        {isCredito ? (
          <>
            <p className="text-sm font-semibold text-gray-800">
              {isCortesia ? 'Diárias cortesia' : 'Pacote pago'} — {mov.dias} diária{mov.dias !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-500">
              {isCortesia ? 'Adicionado em ' : 'Pago em '}{formatDate(mov.data)}
              {!isCortesia && ` · ${fmtMoeda(mov.valorPago ?? 0)}`}
              {mov.formaPagamento && !isCortesia ? ` · ${FORMA_LABELS[mov.formaPagamento] ?? mov.formaPagamento}` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">{isAjuste ? mov.descricao : 'Presença na creche'}</p>
            <p className="text-xs text-gray-400">{formatDate(mov.data)}</p>
          </>
        )}
      </div>
      <div className="text-right w-10 flex-shrink-0">
        <span className={`text-sm font-semibold ${deltaCor}`}>
          {mov.dias > 0 ? '+' : ''}{mov.dias}
        </span>
      </div>
      <div className="text-right w-12 flex-shrink-0">
        <span className={`text-sm font-bold ${saldoCor(mov.saldoApos)}`}>{mov.saldoApos}d</span>
      </div>
    </div>
  )
}
