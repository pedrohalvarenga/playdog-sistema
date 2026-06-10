import type { StatusAgendamento } from '@/types/banho_tosa'

export const STATUS_BT_LABELS: Record<StatusAgendamento, string> = {
  agendado:       'Agendado',
  em_atendimento: 'Em atendimento',
  pronto:         'Pronto',
  entregue:       'Entregue',
  cancelado:      'Cancelado',
}

export const STATUS_BT_CORES: Record<StatusAgendamento, string> = {
  agendado:       'bg-blue-100 text-blue-700',
  em_atendimento: 'bg-orange-100 text-orange-700',
  pronto:         'bg-green-100 text-green-700',
  entregue:       'bg-gray-100 text-gray-600',
  cancelado:      'bg-red-100 text-red-600',
}

export function proximoStatusBT(status: StatusAgendamento): StatusAgendamento | null {
  const flow: Record<StatusAgendamento, StatusAgendamento | null> = {
    agendado:       'em_atendimento',
    em_atendimento: 'pronto',
    pronto:         'entregue',
    entregue:       null,
    cancelado:      null,
  }
  return flow[status]
}

export function formatHora(hora: string | null): string {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

export function formatCurrencyBT(value: number | null): string {
  if (value == null) return '—'
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}
