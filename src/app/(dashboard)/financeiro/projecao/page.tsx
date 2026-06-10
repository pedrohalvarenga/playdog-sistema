import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import Card from '@/components/ui/Card'
import ProjecaoChart from '@/components/financeiro/ProjecaoChart'
import { formatCurrency } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { SaldoConta, ProjecaoMes } from '@/types/financeiro'

export default async function ProjecaoCaixaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
  if (profile?.role !== 'admin') redirect('/financeiro')

  const hoje = new Date()
  const anoHoje = hoje.getFullYear()
  const mesHoje = hoje.getMonth() // 0-based

  // Saldo atual consolidado
  const { data: saldos } = await supabase.from('v_saldo_contas').select('*').returns<SaldoConta[]>()
  const saldoAtual = (saldos ?? []).reduce((s, c) => s + c.saldo_atual, 0)

  // Caixa mínimo configurável
  const { data: configMin } = await supabase
    .from('configuracoes').select('valor').eq('chave', 'caixa_minimo').single()
  const caixaMinimo = parseFloat(configMin?.valor ?? '5000')

  // Histórico de receitas e despesas para sazonalidade (todos os dados pagos)
  const [{ data: histRec }, { data: histDesp }] = await Promise.all([
    supabase.from('receitas').select('data, valor, valor_liquido').eq('status', 'pago'),
    supabase.from('despesas').select('data, valor, categoria').eq('status', 'pago'),
  ])

  // Agrupa por YYYY-MM
  const buckets: Record<string, { receitas: number; despesas: number }> = {}
  for (const r of histRec ?? []) {
    const ym = r.data.substring(0, 7)
    if (!buckets[ym]) buckets[ym] = { receitas: 0, despesas: 0 }
    buckets[ym].receitas += r.valor_liquido ?? r.valor
  }
  for (const d of histDesp ?? []) {
    if (d.categoria === 'investimento') continue
    const ym = d.data.substring(0, 7)
    if (!buckets[ym]) buckets[ym] = { receitas: 0, despesas: 0 }
    buckets[ym].despesas += d.valor
  }

  // Média por mês do calendário (1-12) — sazonalidade
  const avgCalendario: Record<number, { avgRec: number; avgDesp: number }> = {}
  for (let m = 1; m <= 12; m++) {
    const entries = Object.entries(buckets).filter(([ym]) => parseInt(ym.split('-')[1]) === m)
    if (entries.length === 0) {
      avgCalendario[m] = { avgRec: 0, avgDesp: 0 }
    } else {
      avgCalendario[m] = {
        avgRec:  entries.reduce((s, [, v]) => s + v.receitas, 0) / entries.length,
        avgDesp: entries.reduce((s, [, v]) => s + v.despesas, 0) / entries.length,
      }
    }
  }

  // Parcelas futuras ainda não pagas nos próximos 12 meses
  const em12 = new Date(anoHoje, mesHoje + 12, 1)
  const hojeStr = hoje.toISOString().split('T')[0]
  const em12Str = em12.toISOString().split('T')[0]

  const { data: parcelasFuturas } = await supabase
    .from('despesas')
    .select('data, valor')
    .eq('status', 'pendente')
    .not('parcelamento_id', 'is', null)
    .gte('data', hojeStr)
    .lte('data', em12Str)

  const parcelasPorMes: Record<string, number> = {}
  for (const p of parcelasFuturas ?? []) {
    const ym = p.data.substring(0, 7)
    parcelasPorMes[ym] = (parcelasPorMes[ym] ?? 0) + p.valor
  }

  // Monta projeção dos próximos 12 meses
  const projecao: ProjecaoMes[] = []
  let saldoAcum = saldoAtual

  for (let i = 0; i < 12; i++) {
    const d = new Date(anoHoje, mesHoje + i, 1)
    const m = d.getMonth() + 1 // 1-based
    const ym = `${d.getFullYear()}-${String(m).padStart(2, '0')}`
    const nomeMes = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('. de ', '/').replace('/', '/')

    const avg = avgCalendario[m] ?? { avgRec: 0, avgDesp: 0 }
    const parcelasExtra = parcelasPorMes[ym] ?? 0

    // Receitas: média sazonal do mês
    const receitasPrevistas = avg.avgRec
    // Despesas: média sazonal + parcelas pendentes adicionais
    const despesasPrevistas = avg.avgDesp + parcelasExtra

    saldoAcum += receitasPrevistas - despesasPrevistas

    projecao.push({
      mes: ym,
      nome_mes: nomeMes,
      receitas_previstas: receitasPrevistas,
      despesas_previstas: despesasPrevistas,
      saldo_projetado: saldoAcum,
      alerta: saldoAcum < caixaMinimo,
    })
  }

  const mesesAlerta = projecao.filter(p => p.alerta).length
  const piorMes = projecao.reduce((min, p) => p.saldo_projetado < min.saldo_projetado ? p : min, projecao[0])

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Projeção de Caixa</h1>
      </div>

      {/* Saldo atual */}
      <Card className="bg-gradient-to-br from-brand-purple to-purple-700 text-white border-0">
        <p className="text-sm opacity-80">Saldo atual</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(saldoAtual)}</p>
        <p className="text-xs opacity-70 mt-1">Base para a projeção</p>
      </Card>

      {/* Alertas */}
      {mesesAlerta > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 font-bold text-lg">!</span>
            </div>
            <div>
              <p className="font-semibold text-red-700 text-sm">
                {mesesAlerta === 1 ? '1 mês' : `${mesesAlerta} meses`} abaixo do mínimo
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                Pior projeção: {piorMes.nome_mes} com {formatCurrency(piorMes.saldo_projetado)}.
                Mínimo configurado: {formatCurrency(caixaMinimo)}.
              </p>
            </div>
          </div>
        </Card>
      )}

      {mesesAlerta === 0 && (
        <Card className="border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-700">
            ✓ Caixa saudável nos próximos 12 meses
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            Nenhum mês projetado abaixo de {formatCurrency(caixaMinimo)}
          </p>
        </Card>
      )}

      {/* Gráfico */}
      <Card>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Saldo projetado — próximos 12 meses
        </p>
        <ProjecaoChart dados={projecao} caixaMinimo={caixaMinimo} />
      </Card>

      {/* Info metodologia */}
      <div className="flex items-start gap-2 bg-slate-50 rounded-2xl p-3 border border-slate-200">
        <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          Projeção baseada na média histórica de cada mês do calendário (sazonalidade)
          + parcelas de financiamentos pendentes. Receitas e despesas futuras podem
          variar conforme o desempenho real do negócio.
        </p>
      </div>

      {/* Config caixa mínimo */}
      <form action={async (fd: FormData) => {
        'use server'
        const { createClient: cc } = await import('@/lib/supabase/server')
        const sb = await cc()
        const valor = fd.get('caixa_minimo') as string
        await sb.from('configuracoes').update({ valor, updated_at: new Date().toISOString() }).eq('chave', 'caixa_minimo')
        const { redirect: rd } = await import('next/navigation')
        rd('/financeiro/projecao')
      }}>
        <Card>
          <p className="text-xs font-semibold text-gray-600 mb-2">Caixa mínimo de segurança</p>
          <div className="flex gap-2">
            <input
              name="caixa_minimo"
              type="number"
              step="500"
              defaultValue={caixaMinimo}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="bg-brand-purple text-white rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Salvar
            </button>
          </div>
        </Card>
      </form>
    </div>
  )
}
