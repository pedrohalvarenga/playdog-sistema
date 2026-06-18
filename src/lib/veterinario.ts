import type { StatusVeterinario } from '@/types/veterinario'

export const STATUS_VET_LABELS: Record<StatusVeterinario, string> = {
  agendado:  'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const STATUS_VET_CORES: Record<StatusVeterinario, string> = {
  agendado:  'bg-blue-100 text-blue-700',
  realizado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-600',
}

export function formatHoraVet(hora: string | null): string {
  if (!hora) return '—'
  return hora.slice(0, 5)
}
