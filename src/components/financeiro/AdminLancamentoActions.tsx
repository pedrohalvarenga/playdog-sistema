'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  id: string
  tipo: 'receita' | 'despesa'
  voltarPara: string
}

export default function AdminLancamentoActions({ id, tipo, voltarPara }: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [deletando, setDeletando] = useState(false)

  async function deletar() {
    setDeletando(true)
    const supabase = createClient()
    const tabela = tipo === 'receita' ? 'receitas' : 'despesas'
    await supabase.from(tabela).delete().eq('id', id)
    router.push(voltarPara)
    router.refresh()
  }

  const editarHref = tipo === 'receita'
    ? `/financeiro/receitas/${id}/editar`
    : `/financeiro/despesas/${id}/editar`

  return (
    <div className="flex gap-3">
      <Link
        href={editarHref}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-brand-purple text-brand-purple font-semibold text-sm"
      >
        <Pencil size={16} />
        Editar
      </Link>

      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-400 text-red-600 font-semibold text-sm"
        >
          <Trash2 size={16} />
          Excluir
        </button>
      ) : (
        <button
          onClick={deletar}
          disabled={deletando}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-60"
        >
          {deletando ? 'Excluindo...' : 'Confirmar exclusão'}
        </button>
      )}
    </div>
  )
}
