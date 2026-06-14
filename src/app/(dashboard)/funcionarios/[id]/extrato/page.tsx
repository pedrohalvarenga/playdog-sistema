'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, AREA_LABELS } from '@/lib/financeiro'
import { formatDate } from '@/lib/utils'
import { comissaoDaReceita, valorBaseComissao, type RegrasComissao, type ReceitaComissionavel } from '@/lib/comissoes'
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
  const [regras, setRegras] = useState<RegrasComissao>({})
  const [receitas, setReceitas] = useState<ReceitaComissionavel[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }

    const inicio = `${ano}-${String(mesNum).padStart(2, '0')}-01`
    const fim = new Date(ano, mesNum, 0).toISOString().split('T')[0]

    const [funcRes, regrasRes, recRes] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase.from('comissao_regras').select('*').eq('funcionario_id', id),
      supabase.from('receitas')
        .select('id, data, valor, valor_liquido, area, descricao, pet:pets(nome)')
        .eq('status', 'pago').eq('executado_por', id)
        .gte('data', inicio).lte('data', fim).order('data'),
    ])

    setF(funcRes.data as Funcionario)
    const map: RegrasComissao = {}
    for (const r of (regrasRes.data as ComissaoRegra[]) ?? []) map[r.tipo] = r.percentual
    setRegras(map)
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

  // Apenas serviços com regra de comissão na área entram no extrato
  const linhas = receitas
    .map(r => ({ r, pct: regras[r.area] ?? 0, comissao: comissaoDaReceita(r, regras) }))
    .filter(x => x.pct > 0)

  const totalComissoes = linhas.reduce((s, x) => s + x.comissao, 0)
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
            {linhas.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-8">Nenhum serviço com comissão neste mês.</td></tr>
            ) : linhas.map(({ r, pct, comissao }) => (
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
