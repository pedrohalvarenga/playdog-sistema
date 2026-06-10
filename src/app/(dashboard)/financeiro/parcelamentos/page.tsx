import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowLeft, Wallet } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Parcelamento } from '@/types/financeiro'

export default async function ParcelamentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const { data: parcelamentos } = await supabase
    .from('parcelamentos')
    .select('*, conta:contas_financeiras(nome)')
    .eq('ativo', true)
    .order('created_at', { ascending: false })

  // Para cada parcelamento busca qtd de parcelas pagas
  const ids = (parcelamentos ?? []).map(p => p.id)
  const { data: parcelas } = ids.length
    ? await supabase.from('despesas').select('parcelamento_id, status').in('parcelamento_id', ids)
    : { data: [] }

  const pagasPorId: Record<string, number> = {}
  ;(parcelas ?? []).forEach(p => {
    if (p.status === 'pago') pagasPorId[p.parcelamento_id] = (pagasPorId[p.parcelamento_id] ?? 0) + 1
  })

  const lista = (parcelamentos ?? []) as Parcelamento[]
  const saldoDevedor = lista.reduce((s, p) => {
    const pagas = pagasPorId[p.id] ?? 0
    return s + (p.num_parcelas - pagas) * p.valor_parcela
  }, 0)

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Dívidas & Parcelamentos</h1>
        <Link href="/financeiro/parcelamentos/novo">
          <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center">
            <Plus size={20} />
          </div>
        </Link>
      </div>

      {/* Saldo devedor total */}
      <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
        <p className="text-sm opacity-80">Saldo devedor total</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(saldoDevedor)}</p>
        <p className="text-xs opacity-70 mt-1">{lista.length} contrato{lista.length !== 1 ? 's' : ''} ativo{lista.length !== 1 ? 's' : ''}</p>
      </Card>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <Wallet size={40} strokeWidth={1.5} />
          <p className="text-sm">Nenhum parcelamento ativo</p>
          <Link href="/financeiro/parcelamentos/novo" className="text-blue-500 font-semibold text-sm">
            + Cadastrar parcelamento
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map(p => {
            const pagas = pagasPorId[p.id] ?? 0
            const restantes = p.num_parcelas - pagas
            const saldo = restantes * p.valor_parcela
            const pct = Math.round((pagas / p.num_parcelas) * 100)
            return (
              <Link key={p.id} href={`/financeiro/parcelamentos/${p.id}`}>
                <Card>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AREA_CORES[p.area]}`}>
                          {AREA_LABELS[p.area]}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">{p.descricao}</p>
                      <p className="text-xs text-gray-400">{p.conta?.nome} · 1ª parcela {formatDate(p.data_primeira_parcela)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-blue-700">{formatCurrency(saldo)}</p>
                      <p className="text-xs text-gray-400">a pagar</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {pagas}/{p.num_parcelas} parcelas
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatCurrency(p.valor_parcela)}/parcela · Total {formatCurrency(p.valor_total)}
                    {p.taxa_juros ? ` · Juros ${p.taxa_juros}% a.m.` : ''}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
