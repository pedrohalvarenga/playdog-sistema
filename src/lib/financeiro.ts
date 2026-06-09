import type { AreaNegocio, CategoriaReceita, CategoriaDespesa, FormaPagamento, StatusFinanceiro, TipoConta } from '@/types/financeiro'

export const AREA_LABELS: Record<AreaNegocio, string> = {
  creche:     'Creche',
  hotel:      'Hotel',
  loja:       'Loja',
  banho_tosa: 'Banho & Tosa',
  transporte: 'Transporte',
  outros:     'Outros',
  geral:      'Geral',
}

export const CATEGORIA_RECEITA_LABELS: Record<CategoriaReceita, string> = {
  diaria_avulsa:  'Diária Avulsa',
  pacote_semanal: 'Pacote Semanal',
  pacote_mensal:  'Pacote Mensal',
  hotel:          'Hotel',
  banho_tosa:     'Banho & Tosa',
  transporte:     'Transporte',
  venda_produto:  'Venda de Produto',
  festa:          'Festa de Aniversário',
  foto:           'Sessão Fotográfica',
  outros:         'Outros',
}

export const CATEGORIA_DESPESA_LABELS: Record<CategoriaDespesa, string> = {
  racao_petiscos:     'Ração & Petiscos',
  limpeza:            'Limpeza',
  produtos_banho_tosa:'Produtos Banho & Tosa',
  salarios:           'Salários',
  comissoes:          'Comissões',
  combustivel:        'Combustível',
  manutencao:         'Manutenção',
  investimento:       'Investimento',
  aluguel:            'Aluguel',
  agua_luz_internet:  'Água / Luz / Internet',
  contador:           'Contador',
  marketing:          'Marketing',
  impostos:           'Impostos',
  taxas_bancarias:    'Taxas Bancárias',
  outros:             'Outros',
}

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix:      'Pix',
  dinheiro: 'Dinheiro',
  debito:   'Débito',
  credito:  'Crédito',
}

export const CONTA_TIPO_LABELS: Record<TipoConta, string> = {
  pagbank_pj: 'PagBank PJ',
  c6_pf:      'C6 PF',
  dinheiro:   'Dinheiro',
}

export const STATUS_LABELS: Record<StatusFinanceiro, string> = {
  pago:      'Pago',
  pendente:  'Pendente',
  cancelado: 'Cancelado',
}

export const AREA_CORES: Record<AreaNegocio, string> = {
  creche:     'bg-purple-100 text-purple-700',
  hotel:      'bg-blue-100 text-blue-700',
  loja:       'bg-green-100 text-green-700',
  banho_tosa: 'bg-pink-100 text-pink-700',
  transporte: 'bg-orange-100 text-orange-700',
  outros:     'bg-gray-100 text-gray-600',
  geral:      'bg-slate-100 text-slate-600',
}

// categorias mapeadas por área (para filtrar no formulário)
export const CATEGORIAS_POR_AREA: Record<AreaNegocio, CategoriaReceita[]> = {
  creche:     ['diaria_avulsa', 'pacote_semanal', 'pacote_mensal', 'outros'],
  hotel:      ['hotel', 'outros'],
  loja:       ['venda_produto', 'outros'],
  banho_tosa: ['banho_tosa', 'outros'],
  transporte: ['transporte', 'outros'],
  outros:     ['festa', 'foto', 'outros'],
  geral:      ['outros'],
}

// Taxa de cartão padrão PagBank (%)
export const TAXAS_PADRAO: Record<string, number> = {
  debito:  1.99,
  credito: 3.49,
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function parseCurrencyInput(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return parseInt(digits || '0', 10) / 100
}

export function calcValorLiquido(valor: number, taxaPercent: number): number {
  return Math.round(valor * (1 - taxaPercent / 100) * 100) / 100
}

export function isInvestimento(categoria: CategoriaDespesa): boolean {
  return categoria === 'investimento'
}

// Retorna 'vencido' | 'urgente' | 'normal' | 'pago' | 'cancelado'
export function statusPendencia(status: StatusFinanceiro, dataVencimento?: string | null): 'vencido' | 'urgente' | 'normal' | 'pago' | 'cancelado' {
  if (status === 'pago') return 'pago'
  if (status === 'cancelado') return 'cancelado'
  if (!dataVencimento) return 'normal'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / 86_400_000)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 7) return 'urgente'
  return 'normal'
}

// Gera datas de parcelas a partir da primeira data
export function gerarDatasParcelas(dataPrimeira: string, numParcelas: number): string[] {
  const datas: string[] = []
  const [ano, mes, dia] = dataPrimeira.split('-').map(Number)
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(ano, mes - 1 + i, dia)
    datas.push(d.toISOString().split('T')[0])
  }
  return datas
}

// Atalhos de lançamento rápido (mais usados)
export const ATALHOS_RAPIDOS: Array<{ label: string; area: AreaNegocio; categoria: CategoriaReceita }> = [
  { label: 'Diária',     area: 'creche',     categoria: 'diaria_avulsa' },
  { label: 'Pacote Mês', area: 'creche',     categoria: 'pacote_mensal' },
  { label: 'Banho/Tosa', area: 'banho_tosa', categoria: 'banho_tosa' },
  { label: 'Hotel',      area: 'hotel',      categoria: 'hotel' },
]
