import type { AreaNegocio } from '@/types/financeiro'

export type TipoCalculo = 'percentual' | 'por_presenca_creche'

// Regra de comissão de um funcionário para uma área.
export interface RegraComissao {
  tipo: AreaNegocio
  tipo_calculo: TipoCalculo
  percentual: number
  // Escalonamento (percentual): acima de `faturamento_limite` de faturamento
  // mensal da área, passa a valer `percentual_acima`.
  faturamento_limite?: number | null
  percentual_acima?: number | null
  // por_presenca_creche: R$ por presença na creche.
  valor_fixo?: number | null
  // A regra só vale a partir desta data (YYYY-MM-DD). Null = sempre.
  vigencia_inicio?: string | null
}

export interface ReceitaComissionavel {
  id: string
  data: string
  valor: number
  valor_liquido: number | null
  area: AreaNegocio
  descricao: string | null
  pet?: { nome: string } | null
}

// Base de cálculo: valor líquido (descontada a taxa de cartão) quando houver.
export function valorBaseComissao(r: { valor: number; valor_liquido?: number | null }): number {
  return r.valor_liquido ?? r.valor
}

// Alíquota efetiva de uma regra percentual, considerando o escalonamento por
// faturamento mensal da área. Ex.: 5% até R$ 10.000 de banho & tosa no mês;
// 10% nos meses em que o faturamento da área passar disso.
export function aliquotaEfetiva(regra: RegraComissao, faturamentoDaArea: number): number {
  if (regra.faturamento_limite != null && regra.percentual_acima != null
      && faturamentoDaArea > regra.faturamento_limite) {
    return regra.percentual_acima
  }
  return regra.percentual
}

// Comissão de UMA receita conforme a regra percentual da sua área (0 se a
// regra não for percentual ou não existir).
export function comissaoDaReceita(
  r: ReceitaComissionavel,
  regra: RegraComissao | undefined,
  faturamentoDaArea = 0,
): number {
  if (!regra || regra.tipo_calculo !== 'percentual') return 0
  return valorBaseComissao(r) * (aliquotaEfetiva(regra, faturamentoDaArea) / 100)
}

// Índice area -> regra (um funcionário tem no máximo uma regra por área).
export function indexarRegras(regras: RegraComissao[]): Partial<Record<AreaNegocio, RegraComissao>> {
  const mapa: Partial<Record<AreaNegocio, RegraComissao>> = {}
  for (const r of regras) mapa[r.tipo] = r
  return mapa
}

// Data efetiva de início da regra dentro de um mês [inicio, fim]: respeita a
// vigência (comissão que começou no meio do mês só conta a partir dali).
export function inicioEfetivo(regra: RegraComissao, inicioMes: string): string {
  return regra.vigencia_inicio && regra.vigencia_inicio > inicioMes ? regra.vigencia_inicio : inicioMes
}
