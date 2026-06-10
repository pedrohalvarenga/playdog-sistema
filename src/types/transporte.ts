export type TipoRota = 'coleta' | 'entrega'
export type StatusRota = 'planejada' | 'em_andamento' | 'finalizada'
export type MeioTransporte = 'playdog' | 'tutor'
export type StatusTransporte = 'pendente' | 'em_rota' | 'concluido' | 'imprevisto' | 'cancelado'
export type OrigemTransporte = 'banho_tosa' | 'hotel' | 'creche'
export type TrechoTransporte = 'buscar' | 'levar' // buscar = ida (coleta) | levar = volta (entrega)

export interface Rota {
  id: string
  data: string
  tipo: TipoRota
  status: StatusRota
  endereco_partida: string | null
  km_inicial: number | null
  km_final: number | null
  distancia_total_km: number | null
  duracao_estimada_min: number | null
  otimizada: boolean
  iniciada_em: string | null
  finalizada_em: string | null
  motorista_id: string | null
  criada_por: string | null
  created_at: string
}

export interface PetTransporte {
  id: string
  nome: string
  identificador: string | null
  foto_url: string | null
  tutor_id: string
  tutor?: {
    nome: string
    telefone: string | null
    whatsapp: string | null
    endereco: string | null
  }
}

export interface Transporte {
  id: string
  origem: OrigemTransporte
  origem_id: string | null
  pet_id: string
  data: string
  horario: string | null
  tipo: TrechoTransporte
  endereco: string
  telefone: string | null
  meio: MeioTransporte
  status: StatusTransporte
  rota_id: string | null
  ordem: number | null
  concluido_em: string | null
  concluido_por: string | null
  motivo_imprevisto: string | null
  distancia_km: number | null
  observacoes: string | null
  created_at: string
  pet?: PetTransporte
}

export interface Abastecimento {
  id: string
  data: string
  km_painel: number
  litros: number
  valor_total: number
  cupom_url: string | null
  motorista_id: string | null
  despesa_id: string | null
  created_at: string
  motorista?: { nome: string }
}

export interface ManutencaoVeiculo {
  id: string
  data: string
  descricao: string
  valor: number
  km: number | null
  despesa_id: string | null
  registrado_por: string | null
  created_at: string
}

export interface ConfigTransporte {
  chave: string
  valor: string
  updated_at: string
}
