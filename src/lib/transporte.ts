import type { StatusTransporte, TipoRota, StatusRota, MeioTransporte, TrechoTransporte } from '@/types/transporte'

export const TIPO_ROTA_LABELS: Record<TipoRota, string> = {
  coleta:  'Coleta (manhã)',
  entrega: 'Entrega (tarde)',
}

export const STATUS_ROTA_LABELS: Record<StatusRota, string> = {
  planejada:    'Planejada',
  em_andamento: 'Em andamento',
  finalizada:   'Finalizada',
}

export const STATUS_ROTA_CORES: Record<StatusRota, string> = {
  planejada:    'bg-blue-100 text-blue-700',
  em_andamento: 'bg-orange-100 text-orange-700',
  finalizada:   'bg-green-100 text-green-700',
}

export const STATUS_TRANSP_LABELS: Record<StatusTransporte, string> = {
  pendente:   'Pendente',
  em_rota:    'Em rota',
  concluido:  'Concluído',
  imprevisto: 'Imprevisto',
  cancelado:  'Cancelado',
}

export const STATUS_TRANSP_CORES: Record<StatusTransporte, string> = {
  pendente:   'bg-gray-100 text-gray-600',
  em_rota:    'bg-blue-100 text-blue-700',
  concluido:  'bg-green-100 text-green-700',
  imprevisto: 'bg-yellow-100 text-yellow-700',
  cancelado:  'bg-red-100 text-red-600',
}

export const MEIO_LABELS: Record<MeioTransporte, string> = {
  playdog: 'Play Dog',
  tutor:   'Tutor',
}

export const TRECHO_LABELS: Record<TrechoTransporte, string> = {
  buscar: 'Ida',
  levar:  'Volta',
}

export const ORIGEM_LABELS: Record<string, string> = {
  banho_tosa: 'Banho & Tosa',
  creche:     'Creche',
  hotel:      'Hotel',
}

export const MOTIVOS_IMPREVISTO = [
  'Não estava em casa',
  'Tutor cancelou',
  'Endereço não encontrado',
  'Outro',
]

// Trecho ↔ rota: ida entra na coleta, volta entra na entrega
export function trechoDaRota(tipoRota: TipoRota): TrechoTransporte {
  return tipoRota === 'coleta' ? 'buscar' : 'levar'
}

export function googleMapsUrl(endereco: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(endereco)}&travelmode=driving`
}

export function wazeUrl(endereco: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '—'
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

export function formatDuracao(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h${String(min % 60).padStart(2, '0')}`
}
