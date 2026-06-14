import type { AreaNegocio } from '@/types/financeiro'

// Mapa área → percentual de comissão de um funcionário
export type RegrasComissao = Partial<Record<AreaNegocio, number>>

export interface ReceitaComissionavel {
  id: string
  data: string
  valor: number
  valor_liquido: number | null
  area: AreaNegocio
  descricao: string | null
  pet?: { nome: string } | null
}

// Base de cálculo: usa o valor líquido (descontada a taxa de cartão) quando houver,
// senão o valor bruto.
export function valorBaseComissao(r: { valor: number; valor_liquido?: number | null }): number {
  return r.valor_liquido ?? r.valor
}

// Comissão de uma única receita conforme as regras (0 se a área não tem regra).
export function comissaoDaReceita(r: ReceitaComissionavel, regras: RegrasComissao): number {
  const pct = regras[r.area]
  if (!pct) return 0
  return valorBaseComissao(r) * (pct / 100)
}

// Total de comissão de uma lista de receitas.
export function totalComissao(receitas: ReceitaComissionavel[], regras: RegrasComissao): number {
  return receitas.reduce((s, r) => s + comissaoDaReceita(r, regras), 0)
}
