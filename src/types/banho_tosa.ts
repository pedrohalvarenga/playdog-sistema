export type StatusAgendamento = 'agendado' | 'em_atendimento' | 'pronto' | 'entregue' | 'cancelado'
export type TipoTaxi = 'buscar' | 'levar' | 'ambos'

export interface AgendamentoBanhoTosa {
  id: string
  pet_id: string
  data: string
  hora_chegada: string
  hora_saida_prevista: string | null
  hora_chegada_real: string | null
  hora_saida_real: string | null
  descricao_servico: string
  valor_servico: number | null
  taxi_dog: boolean
  taxi_tipo: TipoTaxi | null
  taxi_endereco: string | null
  valor_taxi: number | null
  status: StatusAgendamento
  motivo_cancelamento: string | null
  observacoes: string | null
  pago_com_pacote: boolean
  receita_servico_id: string | null
  receita_taxi_id: string | null
  registrado_por: string | null
  created_at: string
  updated_at: string
  pet?: {
    id: string
    nome: string
    identificador: string | null
    foto_url: string | null
    porte: string
    tutor_id: string
    tipo_banho?: 'avulso' | 'pacote'
    saldo_banhos?: number
    tutor?: {
      nome: string
      telefone: string | null
      whatsapp: string | null
      endereco: string | null
    }
  }
}
