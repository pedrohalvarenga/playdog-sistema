'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface PendenciaActionsProps {
  id: string
  tipo: 'receita' | 'despesa'
}

export default function PendenciaActions({ id, tipo }: PendenciaActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function marcarPago() {
    setLoading(true)
    const supabase = createClient()
    const tabela = tipo === 'receita' ? 'receitas' : 'despesas'
    await supabase.from(tabela).update({
      status: 'pago',
      data: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={e => { e.preventDefault(); marcarPago() }}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <Check size={14} />
      )}
      Pago
    </button>
  )
}
