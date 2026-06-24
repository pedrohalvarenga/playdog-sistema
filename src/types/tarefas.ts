export type StatusTarefa = 'pendente' | 'concluida'
export type TarefaPerm = 'gerente' | 'criador'

export interface Pessoa {
  id: string
  nome: string
  role: string
}

export interface Tarefa {
  id: string
  titulo: string
  data: string
  horario: string | null
  ordem: number | null
  atribuido_para: string | null
  status: StatusTarefa
  concluida_em: string | null
  concluida_por: string | null
  observacoes: string | null
  atividade_id: string | null
  empresa_id: string | null
  criada_por: string | null
  created_at: string
  updated_at: string
}

export interface AtividadeTarefa {
  id: string
  nome: string
  vezes_usada: number
  ultimo_uso: string
}
