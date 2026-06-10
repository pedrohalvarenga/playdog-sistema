'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Eye, Trash2 } from 'lucide-react'

interface Props {
  tipo: 'pet' | 'tutor'
  id: string
  ativo: boolean
  nome: string
  redirectApos?: string
}

export default function AdminActions({ tipo, id, ativo, nome, redirectApos }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'ocultar' | 'excluir' | null>(null)

  async function ocultar() {
    setLoading('ocultar')
    const res = await fetch('/api/admin/registro', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, ativo: !ativo }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert('Erro: ' + (err.error ?? 'Não foi possível alterar'))
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  async function excluir() {
    const avisoTutor = tipo === 'tutor' ? '\n\n⚠️ ATENÇÃO: todos os cães cadastrados deste tutor também serão excluídos.' : ''
    const confirmar = window.confirm(
      `Tem certeza que deseja EXCLUIR permanentemente "${nome}"?${avisoTutor}\n\nEsta ação não pode ser desfeita. Use "Ocultar" se quiser apenas remover da lista sem perder o histórico.`
    )
    if (!confirmar) return
    setLoading('excluir')
    const res = await fetch('/api/admin/registro', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert('Erro: ' + (err.error ?? 'Não foi possível excluir'))
      setLoading(null)
    } else {
      router.push(redirectApos ?? (tipo === 'pet' ? '/pets' : '/tutores'))
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Ações administrativas</p>
      <div className="flex gap-2">
        <button
          onClick={ocultar}
          disabled={loading !== null}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            ativo
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {loading === 'ocultar' ? (
            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : ativo ? (
            <><EyeOff size={16} /> Ocultar</>
          ) : (
            <><Eye size={16} /> Reativar</>
          )}
        </button>
        <button
          onClick={excluir}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading === 'excluir' ? (
            <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
          ) : (
            <><Trash2 size={16} /> Excluir</>
          )}
        </button>
      </div>
      {!ativo && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-2 text-center">
          Este cadastro está oculto e não aparece nas listas
        </p>
      )}
    </div>
  )
}
