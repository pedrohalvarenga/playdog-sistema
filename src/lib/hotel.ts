import type { StatusHospedagem, OcupacaoNivel } from '@/types/hotel'
import { diaLocal } from '@/lib/datas'

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
  // Conta as noites pelos dias no fuso de Juiz de Fora
  const a = new Date(diaLocal(new Date(checkin)) + 'T12:00:00Z')
  const b = new Date(diaLocal(new Date(checkout)) + 'T12:00:00Z')
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function formatCurrencyHotel(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dormindoNaNoite(checkinPrevisto: string, checkoutPrevisto: string, noite: string): boolean {
  // Compara os dias no fuso de Juiz de Fora (strings YYYY-MM-DD comparam em ordem)
  const ci = diaLocal(new Date(checkinPrevisto))
  const co = diaLocal(new Date(checkoutPrevisto))
  return ci <= noite && co > noite
}
