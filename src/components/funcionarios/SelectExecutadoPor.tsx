'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Funcionario } from '@/types/funcionario'

interface Props {
  value: string
  onChange: (id: string) => void
  label?: string
  className?: string
}

// Seletor de "quem executou o serviço" — base do cálculo de comissão.
// Lista funcionários ativos que recebem comissão.
export default function SelectExecutadoPor({ value, onChange, label = 'Quem executou (comissão)', className }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).eq('recebe_comissao', true).order('nome')
      .then(({ data }) => setFuncionarios((data as Funcionario[]) ?? []))
  }, [])

  if (funcionarios.length === 0) return null

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
        <option value="">— Ninguém / não aplicável —</option>
        {funcionarios.map(f => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>
    </div>
  )
}
