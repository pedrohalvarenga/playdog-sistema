import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/financeiro/StatusBadge'
import PendenciaActions from '@/components/financeiro/PendenciaActions'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { AREA_LABELS, AREA_CORES } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Parcelamento, Despesa } from '@/types/financeiro'

export default async function ParcelamentoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const { data: parc } = await supabase
    .from('parcelamentos')
    .select('*, conta:contas_financeiras(nome)')
    .eq('id', id)
    .single<Parcelamento>()

  if (!parc) notFound()

  const { data: parcelas } = await supabase
    .from('despesas')
    .select('*')
    .eq('parcelamento_id', id)
    .order('num_parcela')

  const lista = (parcelas ?? []) as Despesa[]
  const pagas = lista.filter(p => p.status === 'pago').length
  const saldoDevedor = (parc.num_parcelas - pagas) * parc.valor_parcela
  const pct = parc.num_parcelas > 0 ? Math.round((pagas / parc.num_parcelas) * 100) : 0

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/financeiro/parcelamentos" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{parc.descricao}</h1>
      </div>

      <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
        <div className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-semibold mb-2 bg-white/20`}>
          {AREA_LABELS[parc.area]}
        </div>
        <p className="text-3xl font-bold">{formatCurrency(saldoDevedor)}</p>
        <p className="text-sm opacity-80">saldo devedor</p>
        <div className="mt-3">
          <div className="flex justify-between text-xs opacity-70 mb-1">
            <span>{pagas} pagas</span>
            <span>{parc.num_parcelas - pagas} restantes</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Card className="text-center py-3">
          <p className="text-xs text-gray-400">Parcela</p>
          <p className="font-bold text-sm">{formatCurrency(parc.valor_parcela)}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-gray-400">Total</p>
          <p className="font-bold text-sm">{formatCurrency(parc.valor_total)}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-gray-400">Conta</p>
          <p className="font-bold text-sm truncate">{parc.conta?.nome}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-gray-400">Juros</p>
          <p className="font-bold text-sm">{parc.taxa_juros ? `${parc.taxa_juros}% a.m.` : '—'}</p>
        </Card>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parcelas</p>
        <div className="flex flex-col gap-2">
          {lista.map(p => (
            <Card key={p.id} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                p.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {p.num_parcela}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Parcela {p.num_parcela}/{parc.num_parcelas}</p>
                <p className="text-xs text-gray-400">
                  Vence {p.data_vencimento ? formatDate(p.data_vencimento) : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="font-bold text-sm text-gray-800">{formatCurrency(p.valor)}</p>
                {p.status === 'pendente'
                  ? <PendenciaActions id={p.id} tipo="despesa" />
                  : <StatusBadge status={p.status} />
                }
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
