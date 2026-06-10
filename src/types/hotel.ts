import type { Pet, Tutor } from './index'

export type StatusHospedagem = 'reservada' | 'hospedado' | 'finalizada' | 'cancelada'

export interface Hospedagem {
  id: string
  pet_id: string
  checkin_previsto: string
  checkout_previsto: string
  checkin_real?: string
  checkout_real?: string
  valor_diaria: number
  valor_total?: number
  valor_extras?: number
  extras_descricao?: string
  observacoes?: string
  status: StatusHospedagem
  motivo_cancelamento?: string
  receita_id?: string
  registrado_por?: string
  alterado_por?: string
  created_at: string
  updated_at: string
  pet?: Pet & { tutor: Tutor }
}

export interface Plantonista {
  id: string
  nome: string
  telefone?: string
  valor_noite: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EscalaPlantao {
  id: string
  data: string
  plantonista_id?: string
  valor_noite?: number
  observacoes?: string
  registrado_por?: string
  alterado_por?: string
  created_at: string
  updated_at: string
  plantonista?: Plantonista
}

export interface ConfigHotel {
  chave: string
  valor: string
}

export type OcupacaoNivel = 'livre' | 'quase_cheio' | 'lotado'

export interface DiaCalendario {
  data: string
  hospedados: number
  capacidade: number
  nivel: OcupacaoNivel
  hospedagens: Hospedagem[]
  entradas: Hospedagem[]
  saidas: Hospedagem[]
  escala?: EscalaPlantao
}
