// ============================================================
// Datas e horários — SEMPRE no fuso de Juiz de Fora / Brasília
// (America/Sao_Paulo). Nunca usar toISOString() para extrair
// o "dia", pois isso usa o horário universal (UTC, +3h) e
// desloca o dia a partir das 21:00 locais.
// ============================================================

export const FUSO_JF = 'America/Sao_Paulo'

/** Dia (YYYY-MM-DD) de um instante, no fuso de Juiz de Fora. */
export function diaLocal(date: string | Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // en-CA gera o formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_JF, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Dia de hoje (YYYY-MM-DD) em Juiz de Fora. */
export function hojeLocal(): string {
  return diaLocal(new Date())
}

/** Hora (HH:mm) de um instante, no fuso de Juiz de Fora. */
export function horaLocal(date: string | Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_JF, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

/**
 * Converte um instante para um Date cujos campos "locais" são o
 * relógio de parede de Juiz de Fora — útil para formatar com date-fns.
 */
export function paraJF(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_JF,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour') === 24 ? 0 : get('hour'), get('minute'), get('second'))
}
