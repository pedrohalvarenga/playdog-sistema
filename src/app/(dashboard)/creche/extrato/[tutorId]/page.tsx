'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Send, Dog, Calendar, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Tutor, Pet, Presenca, ComprasDiarias } from '@/types'
import { diaLocal } from '@/lib/datas'

type PresencaComPet = Presenca & { pet: Pet }
type CompraComPet = ComprasDiarias & { pet: Pet }

interface PetExtrato {
  pet: Pet
  presencas: PresencaComPet[]
  compras: CompraComPet[]
  saldoFinal: number
}

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

export default function ExtratoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
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

      const [{ data: tutorData }, { data: pets }] = await Promise.all([
        supabase.from('tutores').select('*').eq('id', tutorId).single(),
        supabase.from('pets').select('*').eq('tutor_id', tutorId).eq('ativo', true),
      ])

      setTutor(tutorData)

      if (!pets || pets.length === 0) { setPetsExtrato([]); setLoading(false); return }

      const petIds = pets.map(p => p.id)

      const [{ data: presencas }, { data: compras }, { data: precos }] = await Promise.all([
        supabase.from('presencas')
          .select('*, pet:pets(*)')
          .in('pet_id', petIds)
          .gte('data', inicio)
          .lte('data', fim)
          .order('data'),
        supabase.from('compras_diarias')
          .select('*, pet:pets(*)')
          .in('pet_id', petIds)
          .gte('data', inicio)
          .lte('data', fim)
          .order('data'),
        supabase.from('precos_padrao').select('*'),
      ])

      const precoPadrao = precos?.find(p => p.plano === 'diaria_avulsa')?.valor ?? 0

      const resultado: PetExtrato[] = pets.map(pet => {
        const pPresencas = (presencas ?? []).filter(p => p.pet_id === pet.id) as PresencaComPet[]
        const pCompras = (compras ?? []).filter(c => c.pet_id === pet.id) as CompraComPet[]
        const precoPet = (tutorData as Tutor)?.preco_personalizado ?? precoPadrao
        const diariasUsadas = pPresencas.length
        const diasComprados = pCompras.reduce((s, c) => s + c.quantidade, 0)
        const saldoFinal = diasComprados - diariasUsadas
        return { pet: pet as Pet, presencas: pPresencas, compras: pCompras, saldoFinal }
      }).filter(e => e.presencas.length > 0 || e.compras.length > 0)

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

  const totalPresencas = petsExtrato.reduce((s, e) => s + e.presencas.length, 0)
  const totalComprado = petsExtrato.reduce((s, e) => s + e.compras.reduce((c, x) => c + x.valor_pago, 0), 0)

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]

  return (
    <>
      {/* Estilos de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { margin: 0; padding: 16px; }
        }
      `}</style>

      <div className="py-6 flex flex-col gap-4 print-page">
        {/* Toolbar — oculta na impressão */}
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
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold"
            >
              <Printer size={16} /> PDF
            </button>
            <button
              onClick={enviarEmail}
              disabled={enviando}
              className="flex items-center gap-1.5 bg-brand-purple text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              <Send size={16} /> {enviando ? 'Enviando...' : 'Enviar e-mail'}
            </button>
          </div>
        </div>

        {/* Seletor de período — oculto na impressão */}
        <div className="no-print flex gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          >
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Cabeçalho da fatura */}
            <div className="bg-brand-purple rounded-3xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
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
              <div className="flex gap-3 mt-3">
                <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-bold">{totalPresencas}</p>
                  <p className="text-xs opacity-80">Presenças</p>
                </div>
                <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-bold">{petsExtrato.length}</p>
                  <p className="text-xs opacity-80">Pet{petsExtrato.length !== 1 ? 's' : ''}</p>
                </div>
                {totalComprado > 0 && (
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-lg font-bold">R$ {totalComprado.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs opacity-80">Pago</p>
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
              petsExtrato.map(e => (
                <PetExtratoCard key={e.pet.id} extrato={e} />
              ))
            )}
          </>
        )}
      </div>
    </>
  )
}

function PetExtratoCard({ extrato }: { extrato: PetExtrato }) {
  const { pet, presencas, compras, saldoFinal } = extrato
  const totalPago = compras.reduce((s, c) => s + c.valor_pago, 0)

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
        <Dog size={18} className="text-brand-purple" />
        <div>
          <p className="font-bold text-gray-900">{pet.nome}</p>
          {(pet as any).identificador && <p className="text-xs text-gray-400">{(pet as any).identificador}</p>}
        </div>
        <div className="ml-auto text-right">
          <span className={`text-sm font-bold ${saldoFinal < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {saldoFinal >= 0 ? '+' : ''}{saldoFinal}d saldo neste mês
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Presenças */}
        {presencas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar size={12} /> Presenças ({presencas.length})
            </p>
            <div className="flex flex-col gap-1">
              {presencas.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{formatDate(p.data, 'dd/MM (EEEE)')}</span>
                  <span className="text-gray-400 text-xs">
                    {p.checkin_at ? formatDate(p.checkin_at, 'HH:mm') : '—'}
                    {' → '}
                    {p.checkout_at ? formatDate(p.checkout_at, 'HH:mm') : 'presente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compras */}
        {compras.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShoppingBag size={12} /> Diárias compradas
            </p>
            <div className="flex flex-col gap-1">
              {compras.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {formatDate(c.data)} — {c.quantidade} diária{c.quantidade !== 1 ? 's' : ''}
                  </span>
                  <div className="text-right">
                    {c.valor_pago > 0 && (
                      <span className="text-green-600 font-semibold text-xs">R$ {c.valor_pago.toFixed(2).replace('.', ',')}</span>
                    )}
                    <span className="text-gray-400 text-xs ml-1">({FORMA_LABELS[c.forma_pagamento] ?? c.forma_pagamento})</span>
                  </div>
                </div>
              ))}
              {totalPago > 0 && (
                <div className="flex justify-between font-semibold text-sm pt-1 border-t border-gray-100 mt-1">
                  <span>Total pago</span>
                  <span className="text-green-700">R$ {totalPago.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
