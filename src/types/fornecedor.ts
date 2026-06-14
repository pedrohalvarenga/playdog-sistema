export type CategoriaFornecedor =
  | 'racao_insumos' | 'medicamentos' | 'aluguel' | 'limpeza_lavanderia'
  | 'servicos' | 'equipamentos' | 'marketing' | 'outros'

export const CATEGORIA_FORNECEDOR_LABELS: Record<CategoriaFornecedor, string> = {
  racao_insumos:      'Ração e insumos',
  medicamentos:       'Medicamentos',
  aluguel:            'Aluguel',
  limpeza_lavanderia: 'Limpeza / Lavanderia',
  servicos:           'Serviços',
  equipamentos:       'Equipamentos',
  marketing:          'Marketing',
  outros:             'Outros',
}

export interface Fornecedor {
  id: string
  empresa_id?: string
  nome: string
  cnpj?: string | null
  categoria?: CategoriaFornecedor | null
  contato_nome?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at: string
}
