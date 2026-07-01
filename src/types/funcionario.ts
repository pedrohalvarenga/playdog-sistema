import type { AreaNegocio } from './financeiro'

export interface Funcionario {
  id: string
  empresa_id?: string
  nome: string
  cargo: string | null
  salario: number
  dia_pagamento: number | null
  ativo: boolean
  // Dados pessoais
  cpf?: string | null
  rg?: string | null
  data_nascimento?: string | null
  foto_url?: string | null
  email?: string | null
  telefone?: string | null
  // Profissional
  data_admissao?: string | null
  // Uniformes
  tam_calca?: string | null
  tam_camisa?: string | null
  tam_sapato?: string | null
  // Acesso ao sistema
  usuario_id?: string | null
  // Comissão
  recebe_comissao?: boolean
  observacoes?: string | null
  created_at: string
}

export interface ComissaoRegra {
  id: string
  funcionario_id: string
  tipo: AreaNegocio
  percentual: number
  // Modelo de cálculo: percentual (padrão) ou fixo por presença na creche.
  tipo_calculo?: 'percentual' | 'por_presenca_creche'
  valor_fixo?: number | null            // R$ por presença
  faturamento_limite?: number | null    // escalonamento: acima disso...
  percentual_acima?: number | null      // ...vale este percentual
  vigencia_inicio?: string | null       // vale a partir desta data
  created_at?: string
}

export interface ComissaoPaga {
  id: string
  funcionario_id: string
  mes_referencia: string
  valor_total: number
  despesa_id: string | null
  created_at?: string
}
