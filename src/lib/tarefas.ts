import type { Tarefa } from '@/types/tarefas'

export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function hhmm(horario: string | null | undefined): string {
  if (!horario) return ''
  return horario.slice(0, 5)
}

/** Cor das iniciais do responsável — estável por id. */
export function corPessoa(id: string): string {
  const cores = [
    'bg-purple-100 text-brand-purple',
    'bg-orange-100 text-brand-orange',
    'bg-teal-100 text-teal-700',
    'bg-blue-100 text-blue-700',
    'bg-rose-100 text-rose-600',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
  ]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % cores.length
  return cores[h]
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

/**
 * Tarefa atrasada: ainda pendente e já passou do momento previsto.
 * - data anterior a hoje; ou
 * - hoje com horário definido que já passou.
 */
export function tarefaAtrasada(t: Tarefa, hoje: string, agoraHHMM: string): boolean {
  if (t.status === 'concluida') return false
  if (t.data < hoje) return true
  if (t.data === hoje && t.horario && hhmm(t.horario) < agoraHHMM) return true
  return false
}
