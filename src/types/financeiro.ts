export type AreaNegocio = 'creche' | 'hotel' | 'loja' | 'banho_tosa' | 'transporte' | 'outros' | 'geral'

export type CategoriaReceita =
  | 'diaria_avulsa' | 'pacote_semanal' | 'pacote_mensal' | 'hotel'
  | 'banho_tosa' | 'transporte' | 'venda_produto' | 'festa' | 'foto' | 'outros'

export type CategoriaDespesa =
  | 'racao_petiscos' | 'limpeza' | 'produtos_banho_tosa' | 'salarios' | 'comissoes'
  | 'combustivel' | 'manutencao' | 'investimento' | 'aluguel' | 'agua_luz_internet'
  | 'contador' | 'marketing' | 'impostos' | 'taxas_bancarias' | 'outros'

export type FormaPagamento = 'pix' | 'dinheiro' | 'debito' | 'credito'

export type StatusFinanceiro = 'pago' | 'pendente' | 'cancelado'

export type TipoConta = 'pagbank_pj' | 'c6_pf' | 'dinheiro'

export interface ContaFinanceira {
  id: string
  nome: string
  tipo: TipoConta
  saldo_inicial: number
  ativo: boolean
  created_at: string
}

export interface SaldoConta extends ContaFinanceira {
  total_receitas: number
  total_despesas: number
  saldo_atual: number
}

export interface Receita {
  id: string
  data: string
  valor: number
  area: AreaNegocio
  categoria: CategoriaReceita
  forma_pagamento: FormaPagamento
  conta_id: string
  taxa_cartao?: number
  valor_liquido?: number
  tutor_id?: string
  pet_id?: string
  descricao?: string
  status: StatusFinanceiro
  num_diarias?: number
  data_vencimento?: string
  registrado_por?: string
  created_at: string
  conta?: ContaFinanceira
  tutor?: { nome: string }
  pet?: { nome: string }
}

export interface Despesa {
  id: string
  data: string
  valor: number
  area: AreaNegocio
  categoria: CategoriaDespesa
  conta_id: string
  tutor_id?: string
  pet_id?: string
  fornecedor?: string
  descricao?: string
  status: StatusFinanceiro
  data_vencimento?: string
  recorrente: boolean
  dia_vencimento?: number
  parcelamento_id?: string
  num_parcela?: number
  registrado_por?: string
  created_at: string
  conta?: ContaFinanceira
  tutor?: { nome: string }
  pet?: { nome: string }
  parcelamento?: Parcelamento
}

export type OrcamentoPeriodo = 'mensal' | 'trimestral' | 'semestral' | 'anual'

export interface Orcamento {
  id: string
  area: AreaNegocio
  periodo: OrcamentoPeriodo
  ano: number
  mes?: number | null
  trimestre?: number | null
  semestre?: number | null
  meta_receita: number
  teto_despesa: number
  registrado_por?: string
  created_at: string
  updated_at: string
}

export interface ResultadoArea {
  area: AreaNegocio
  receita_bruta: number
  taxas_cartao: number
  despesas_diretas: number
  investimentos: number
  rateio_geral: number
  resultado: number
}

export interface ProjecaoMes {
  mes: string
  nome_mes: string
  receitas_previstas: number
  despesas_previstas: number
  saldo_projetado: number
  alerta: boolean
}

export interface Parcelamento {
  id: string
  descricao: string
  valor_total: number
  num_parcelas: number
  valor_parcela: number
  taxa_juros?: number
  data_primeira_parcela: string
  conta_id: string
  area: AreaNegocio
  ativo: boolean
  registrado_por?: string
  created_at: string
  conta?: ContaFinanceira
  parcelas?: Despesa[]
  parcelas_pagas?: number
}
