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

/** Mês de hoje ('YYYY-MM') no fuso de Juiz de Fora. */
export function mesAtualLocal(): string {
  return hojeLocal().slice(0, 7)
}

/**
 * Limites de mês calculados por aritmética de string/número — NUNCA por
 * `new Date(ano, mes, dia)`, que no servidor da Vercel (UTC) cai no fuso
 * errado e desloca o dia. Recebem 'YYYY-MM' (ou 'YYYY-MM-DD').
 */

/** Primeiro dia do mês: 'YYYY-MM-01'. */
export function inicioMes(anoMes: string): string {
  return `${anoMes.slice(0, 7)}-01`
}

/** Último dia do mês: 'YYYY-MM-DD' (sem dependência de fuso). */
export function fimMes(anoMes: string): string {
  const ano = Number(anoMes.slice(0, 4))
  const mes = Number(anoMes.slice(5, 7)) // 1-based
  // dia 0 do mês seguinte = último dia do mês atual; Date.UTC evita o fuso
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${anoMes.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`
}

/** Primeiro dia do mês SEGUINTE: 'YYYY-MM-01' (limite superior exclusivo, usar com `.lt`). */
export function inicioMesSeguinte(anoMes: string): string {
  const ano = Number(anoMes.slice(0, 4))
  const mes = Number(anoMes.slice(5, 7)) // 1-based
  return mes === 12
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
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
