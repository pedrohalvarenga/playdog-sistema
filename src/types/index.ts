export type UserRole = 'admin' | 'recepcao' | 'banho_tosa' | 'motorista'

export type Porte = 'P' | 'M' | 'G'

export type PlanoTipo = 'diaria_avulsa' | 'pacote_semanal' | 'pacote_mensal' | 'hotel'

export interface Profile {
  id: string
  email: string
  nome: string
  role: UserRole
  ativo: boolean
  created_at: string
}

export interface Tutor {
  id: string
  nome: string
  telefone: string
  whatsapp?: string
  cpf?: string
  endereco?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface Pet {
  id: string
  tutor_id: string
  nome: string
  raca?: string
  porte: Porte
  data_nascimento?: string
  foto_url?: string
  castrado: boolean
  restricoes?: string
  comportamento?: string
  vacina_v8_v10?: string
  vacina_antirabica?: string
  vacina_gripe?: string
  plano: PlanoTipo
  plano_diarias_total?: number
  plano_inicio?: string
  plano_fim?: string
  ativo: boolean
  created_at: string
  updated_at: string
  tutor?: Tutor
}

export interface Presenca {
  id: string
  pet_id: string
  data: string
  checkin_at?: string
  checkout_at?: string
  observacoes?: string
  registrado_por?: string
  created_at: string
  pet?: Pet
}

export interface DiariaSaldo {
  id: string
  pet_id: string
  plano: PlanoTipo
  diarias_contratadas: number
  diarias_usadas: number
  periodo_inicio: string
  periodo_fim: string
  created_at: string
}
