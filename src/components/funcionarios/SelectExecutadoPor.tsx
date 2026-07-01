'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Funcionario } from '@/types/funcionario'

interface Props {
  value: string
  onChange: (id: string) => void
  label?: string
  className?: string
  // Se o valor estiver vazio, pré-seleciona o funcionário cujo cargo contém
  // este texto (ex.: "banho" pré-seleciona a pessoa do banho & tosa).
  autoSelectCargo?: string
}

// Seletor de "quem executou o serviço" — base do cálculo de comissão.
// Lista funcionários ativos que recebem comissão.
export default function SelectExecutadoPor({ value, onChange, label = 'Quem executou (comissão)', className, autoSelectCargo }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const autoFeito = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    // Via RPC SECURITY DEFINER: recepção/banho também veem (sem expor salários)
    supabase.rpc('funcionarios_comissionaveis')
      .then(({ data }) => {
        const lista = (data as Funcionario[]) ?? []
        setFuncionarios(lista)
        if (!autoFeito.current && !value && autoSelectCargo) {
          const alvo = autoSelectCargo.toLowerCase()
          const match = lista.find(f => (f.cargo ?? '').toLowerCase().includes(alvo))
          if (match) { autoFeito.current = true; onChange(match.id) }
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
