'use client'

import { useState } from 'react'
import { CircleDollarSign, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { hojeLocal } from '@/lib/datas'

interface PendenciaActionsProps {
  id: string
  tipo: 'receita' | 'despesa'
}

export default function PendenciaActions({ id, tipo }: PendenciaActionsProps) {
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const router = useRouter()

  const labelAcao = tipo === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento'

  async function confirmar() {
    setLoading(true)
    const supabase = createClient()
    const tabela = tipo === 'receita' ? 'receitas' : 'despesas'
    await supabase.from(tabela).update({
      status: 'pago',
      data: hojeLocal(),
    }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-500 font-medium">Confirmar?</span>
        <button
          onClick={e => { e.preventDefault(); confirmar() }}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Sim
        </button>
        <button
          onClick={e => { e.preventDefault(); setConfirmando(false) }}
          disabled={loading}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 active:scale-95 transition-transform"
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); setConfirmando(true) }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-brand-purple text-brand-purple bg-white text-xs font-bold active:scale-95 transition-transform hover:bg-purple-50"
    >
      <CircleDollarSign size={14} />
      {labelAcao}
    </button>
  )
}
