export type StatusVeterinario = 'agendado' | 'realizado' | 'cancelado'

export interface AgendamentoVeterinario {
  id: string
  pet_id: string
  data: string
  hora: string | null
  motivo: string
  observacoes: string | null
  status: StatusVeterinario
  motivo_cancelamento: string | null
  registrado_por: string | null
  created_at: string
  updated_at: string
  pet?: {
    id: string
    nome: string
    identificador: string | null
    foto_url: string | null
    tutor_id: string
    tutor?: {
      nome: string
      telefone: string | null
      whatsapp: string | null
    }
  }
}
