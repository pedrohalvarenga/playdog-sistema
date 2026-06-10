import type { StatusHospedagem, OcupacaoNivel } from '@/types/hotel'

export const STATUS_HOTEL_LABELS: Record<StatusHospedagem, string> = {
  reservada:  'Reservada',
  hospedado:  'Hospedado',
  finalizada: 'Finalizada',
  cancelada:  'Cancelada',
}

export const STATUS_HOTEL_CORES: Record<StatusHospedagem, string> = {
  reservada:  'bg-blue-100 text-blue-700',
  hospedado:  'bg-green-100 text-green-700',
  finalizada: 'bg-gray-100 text-gray-600',
  cancelada:  'bg-red-100 text-red-500',
}

export const OCUPACAO_CORES: Record<OcupacaoNivel, string> = {
  livre:       'bg-green-500',
  quase_cheio: 'bg-yellow-400',
  lotado:      'bg-red-500',
}

export function calcNivel(hospedados: number, capacidade: number): OcupacaoNivel {
  if (capacidade === 0) return 'livre'
  const pct = hospedados / capacidade
  if (pct >= 1) return 'lotado'
  if (pct >= 0.7) return 'quase_cheio'
  return 'livre'
}

export function calcNoites(checkin: string, checkout: string): number {
  const a = new Date(checkin)
  const b = new Date(checkout)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function formatCurrencyHotel(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dormindoNaNoite(checkinPrevisto: string, checkoutPrevisto: string, noite: string): boolean {
  const ci = new Date(checkinPrevisto)
  const co = new Date(checkoutPrevisto)
  const n = new Date(noite + 'T12:00:00')
  ci.setHours(0, 0, 0, 0)
  co.setHours(0, 0, 0, 0)
  return ci <= n && co > n
}
