import { cn } from '@/lib/utils'
import type { StatusFinanceiro } from '@/types/financeiro'

interface StatusBadgeProps {
  status: StatusFinanceiro
  dataVencimento?: string | null
  className?: string
}

const MAP = {
  pago:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
  pendente:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
  vencido:   { label: 'Vencido',   cls: 'bg-red-100 text-red-700' },
}

export default function StatusBadge({ status, dataVencimento, className }: StatusBadgeProps) {
  let key: keyof typeof MAP = status
  if (status === 'pendente' && dataVencimento) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const venc = new Date(dataVencimento + 'T00:00:00')
    if (venc < hoje) key = 'vencido'
  }
  const { label, cls } = MAP[key]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', cls, className)}>
      {label}
    </span>
  )
}
