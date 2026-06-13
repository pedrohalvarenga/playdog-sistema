import type { Pet, Tutor } from './index'

export type StatusAdaptacao = 'agendada' | 'realizada' | 'cancelada'

export interface Adaptacao {
  id: string
  empresa_id?: string
  pet_id: string
  data: string
  hora_entrada: string
  hora_saida?: string | null
  status: StatusAdaptacao
  observacoes?: string | null
  origem: 'interno' | 'link'
  created_at: string
  updated_at: string
  pet?: Pet & { tutor?: Tutor }
}

export const STATUS_ADAPTACAO_LABELS: Record<StatusAdaptacao, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

export const STATUS_ADAPTACAO_CORES: Record<StatusAdaptacao, string> = {
  agendada: 'bg-blue-100 text-blue-700',
  realizada: 'bg-green-100 text-green-700',
  cancelada: 'bg-gray-100 text-gray-500',
}
