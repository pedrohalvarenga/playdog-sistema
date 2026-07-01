'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, AREA_LABELS } from '@/lib/financeiro'
import { formatDate } from '@/lib/utils'
import { inicioMes, fimMes } from '@/lib/datas'
import { valorBaseComissao, aliquotaEfetiva, inicioEfetivo, indexarRegras, type RegraComissao, type ReceitaComissionavel } from '@/lib/comissoes'
import type { Profile } from '@/types'
import type { Funcionario, ComissaoRegra } from '@/types/funcionario'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function ExtratoInner() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const id = params.id
  const mesRef = search.get('mes') ?? new Date().toISOString().slice(0, 7)
  const [ano, mesNum] = mesRef.split('-').map(Number)

  const [f, setF] = useState<Funcionario | null>(null)
  const [regras, setRegras] = useState<RegraComissao[]>([])
  const [faturamentoPorArea, setFaturamentoPorArea] = useState<Record<string, number>>({})
  const [presencasDatas, setPresencasDatas] = useState<string[]>([])
  const [receitas, setReceitas] = useState<ReceitaComissionavel[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }

    const ym = `${ano}-${String(mesNum).padStart(2, '0')}`
    const inicio = inicioMes(ym)
    const fim = fimMes(ym)

    const [funcRes, regrasRes, recRes, fatRes, presRes] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('comissao_regras').select('*').eq('funcionario_id', id),
      supabase.from('receitas')
        .select('id, data, valor, valor_liquido, area, descricao, pet:pets(nome)')
        .eq('status', 'pago').eq('executado_por', id)
        .gte('data', inicio).lte('data', fim).order('data'),
      supabase.from('receitas').select('area, valor')
        .eq('status', 'pago').gte('data', inicio).lte('data', fim),
      supabase.from('presencas').select('data').gte('data', inicio).lte('data', fim),
    ])

    setF(funcRes.data as Funcionario)
    setRegras(((regrasRes.data as ComissaoRegra[]) ?? []).map(r => ({
      tipo: r.tipo,
      tipo_calculo: r.tipo_calculo ?? 'percentual',
      percentual: Number(r.percentual),
      faturamento_limite: r.faturamento_limite ?? null,
      percentual_acima: r.percentual_acima ?? null,
      valor_fixo: r.valor_fixo ?? null,
      vigencia_inicio: r.vigencia_inicio ?? null,
    })))
    const fat: Record<string, number> = {}
    for (const r of (fatRes.data as { area: string; valor: number }[]) ?? []) fat[r.area] = (fat[r.area] ?? 0) + Number(r.valor)
    setFaturamentoPorArea(fat)
    setPresencasDatas(((presRes.data as { data: string }[]) ?? []).map(p => p.data))
    setReceitas((recRes.data as unknown as ReceitaComissionavel[]) ?? [])
    setLoading(false)
  }, [id, ano, mesNum, router])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!f) return <div className="py-6 text-center text-gray-500">Funcionário não encontrado.</div>

  const inicio = inicioMes(mesRef)
  const fim = fimMes(mesRef)
  const regraPorArea = indexarRegras(regras)

  // Serviços com regra percentual na área (alíquota escalonada quando houver).
  const linhas = receitas
    .map(r => {
      const regra = regraPorArea[r.area]
      if (!regra || regra.tipo_calculo !== 'percentual') return null
      const pct = aliquotaEfetiva(regra, faturamentoPorArea[r.area] ?? 0)
      return { r, pct, comissao: valorBaseComissao(r) * pct / 100 }
    })
    .filter((x): x is { r: ReceitaComissionavel; pct: number; comissao: number } => x !== null && x.pct > 0)

  // Regras de comissão fixa por presença (ex.: creche R$ 1,00 por presença).
  const linhasPresenca = regras
    .filter(rg => rg.tipo_calculo === 'por_presenca_creche')
    .map(rg => {
      const ini = inicioEfetivo(rg, inicio)
      const qtd = presencasDatas.filter(d => d >= ini && d <= fim).length
      return { area: rg.tipo, qtd, valorFixo: rg.valor_fixo ?? 0, comissao: Math.round(qtd * (rg.valor_fixo ?? 0) * 100) / 100 }
    })
    .filter(x => x.qtd > 0)

  const totalComissoes = linhas.reduce((s, x) => s + x.comissao, 0) + linhasPresenca.reduce((s, x) => s + x.comissao, 0)
  const totalAPagar = f.salario + totalComissoes

  return (
    <div className="py-6 flex flex-col gap-4 print-page">
      <style>{`
        @media print {
          header, nav, .fixed, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Toolbar (oculta na impressão) */}
      <div className="no-print flex items-center justify-between gap-2">
        <Link href="/funcionarios/comissoes" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={22} /></Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold">
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Cabeçalho da fatura */}
      <div className="bg-brand-purple rounded-3xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs opacity-70 uppercase tracking-wider font-semibold">Play Dog</p>
            <h2 className="text-xl font-bold">Extrato de Comissões</h2>
            <p className="text-white/80 capitalize">{MESES[mesNum - 1]} / {ano}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70">Funcionário</p>
            <p className="font-bold">{f.nome}</p>
            {f.cargo && <p className="text-sm opacity-80">{f.cargo}</p>}
          </div>
        </div>
      </div>

      {/* Tabela de serviços */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left font-semibold px-3 py-2.5" style={{ width: '18%' }}>Data</th>
              <th className="text-left font-semibold px-3 py-2.5" style={{ width: '42%' }}>Serviço · pet</th>
              <th className="text-right font-semibold px-3 py-2.5" style={{ width: '20%' }}>Valor</th>
              <th className="text-right font-semibold px-2 py-2.5" style={{ width: '8%' }}>%</th>
              <th className="text-right font-semibold px-3 py-2.5" style={{ width: '22%' }}>Comissão</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && linhasPresenca.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-8">Nenhuma comissão neste mês.</td></tr>
            ) : (<>
              {linhas.map(({ r, pct, comissao }) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-gray-600">{formatDate(r.data)}</td>
                  <td className="px-3 py-2.5 text-gray-800">
                    <span className="font-medium">{AREA_LABELS[r.area]}</span>
                    {r.pet?.nome && <span className="text-gray-400"> · {r.pet.nome}</span>}
                    {r.descricao && <span className="block text-xs text-gray-400 truncate">{r.descricao}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{formatCurrency(valorBaseComissao(r))}</td>
                  <td className="px-2 py-2.5 text-right text-gray-500">{pct}%</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-teal-600">{formatCurrency(comissao)}</td>
                </tr>
              ))}
              {linhasPresenca.map((p, i) => (
                <tr key={`pres-${i}`} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-gray-600">—</td>
                  <td className="px-3 py-2.5 text-gray-800">
                    <span className="font-medium">{AREA_LABELS[p.area]}</span>
                    <span className="text-gray-400"> · {p.qtd} presença{p.qtd !== 1 ? 's' : ''} no mês</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{p.qtd}×</td>
                  <td className="px-2 py-2.5 text-right text-gray-500">{formatCurrency(p.valorFixo)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-teal-600">{formatCurrency(p.comissao)}</td>
                </tr>
              ))}
            </>)}
          </tbody>
        </table>
      </div>

      {/* Rodapé / totais */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total de comissões</span>
          <span className="font-semibold text-teal-600">{formatCurrency(totalComissoes)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Salário base</span>
          <span className="font-semibold text-gray-800">{formatCurrency(f.salario)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
          <span className="font-bold text-gray-900">Total a pagar</span>
          <span className="text-2xl font-bold text-brand-purple">{formatCurrency(totalAPagar)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center no-print">
        Comissão calculada sobre o valor recebido (líquido de taxas) dos serviços executados.
      </p>

      <div className="pb-6" />
    </div>
  )
}

export default function ExtratoComissaoPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Carregando...</div>}>
      <ExtratoInner />
    </Suspense>
  )
}
