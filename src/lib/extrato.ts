// Monta a "conta corrente" de diárias da creche: saldo anterior + movimentos
// cronológicos (compras +, presenças −, ajustes ±) com saldo acumulado.
// Usado tanto na tela (creche/extrato) quanto no PDF/e-mail (enviar-extrato),
// para que os dois fiquem sempre idênticos.

export type MovimentoTipo = 'compra' | 'presenca' | 'ajuste'

export interface MovimentoExtrato {
  tipo: MovimentoTipo
  data: string          // YYYY-MM-DD (data do movimento; para compra = data do pagamento)
  descricao: string
  dias: number          // crédito (+) ou débito (−) em diárias
  saldoApos: number     // saldo acumulado após este movimento
  valorPago?: number
  formaPagamento?: string
  motivo?: string
}

interface CompraInput {
  data: string
  quantidade: number
  valor_pago: number
  forma_pagamento: string
  created_at?: string
}
interface PresencaInput {
  data: string
  created_at?: string
}
interface AjusteInput {
  created_at: string
  quantidade: number
  motivo: string
}

export function montarContaCorrente(params: {
  saldoAnterior: number
  compras: CompraInput[]
  presencas: PresencaInput[]
  ajustes: AjusteInput[]
}): { movimentos: MovimentoExtrato[]; saldoFinal: number } {
  const { saldoAnterior, compras, presencas, ajustes } = params

  type Item = { sortDate: string; ts: string; mov: Omit<MovimentoExtrato, 'saldoApos'> }
  const itens: Item[] = [
    ...compras.map((c) => ({
      sortDate: c.data,
      ts: c.created_at ?? `${c.data}T00:00:01`,
      mov: {
        tipo: 'compra' as const,
        data: c.data,
        dias: c.quantidade,
        descricao: `Compra de ${c.quantidade} diária${c.quantidade !== 1 ? 's' : ''}`,
        valorPago: c.valor_pago,
        formaPagamento: c.forma_pagamento,
      },
    })),
    ...ajustes.map((a) => ({
      sortDate: a.created_at.slice(0, 10),
      ts: a.created_at,
      mov: {
        tipo: 'ajuste' as const,
        data: a.created_at.slice(0, 10),
        dias: a.quantidade,
        descricao: `Ajuste: ${a.motivo}`,
        motivo: a.motivo,
      },
    })),
    ...presencas.map((p) => ({
      sortDate: p.data,
      ts: p.created_at ?? `${p.data}T12:00:00`,
      mov: {
        tipo: 'presenca' as const,
        data: p.data,
        dias: -1,
        descricao: 'Presença na creche',
      },
    })),
  ]

  itens.sort((a, b) => {
    if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1
    return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0
  })

  let saldo = saldoAnterior
  const movimentos: MovimentoExtrato[] = itens.map((it) => {
    saldo += it.mov.dias
    return { ...it.mov, saldoApos: saldo }
  })

  return { movimentos, saldoFinal: saldo }
}
