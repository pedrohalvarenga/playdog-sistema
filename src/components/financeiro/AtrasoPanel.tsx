'use client'

import { useState } from 'react'
import { Dog, Users, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'

export interface AtrasoItem {
  nome: string
  atrasoMedio: number   // dias
  qtd: number           // nº de lançamentos vencidos
  total: number         // soma em aberto
}

export default function AtrasoPanel({ porTutor, porPet }: { porTutor: AtrasoItem[]; porPet: AtrasoItem[] }) {
  const [aba, setAba] = useState<'tutor' | 'pet'>('tutor')
  const lista = aba === 'tutor' ? porTutor : porPet

  if (porTutor.length === 0 && porPet.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <AlertTriangle size={15} className="text-orange-500" /> Atraso médio (em aberto)
        </p>
        <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
          <button
            onClick={() => setAba('tutor')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${aba === 'tutor' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
          >
            <Users size={12} /> Tutor
          </button>
          <button
            onClick={() => setAba('pet')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${aba === 'pet' ? 'bg-white shadow text-brand-purple' : 'text-gray-500'}`}
          >
            <Dog size={12} /> Pet
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">Nenhum vencido por {aba}.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lista.map((it, i) => (
            <div key={`${it.nome}-${i}`} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{it.nome}</p>
                <p className="text-[10px] text-gray-400">{it.qtd} vencido{it.qtd !== 1 ? 's' : ''} · {formatCurrency(it.total)}</p>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 ${it.atrasoMedio >= 15 ? 'text-red-600' : it.atrasoMedio >= 7 ? 'text-orange-500' : 'text-gray-500'}`}>
                {it.atrasoMedio} {it.atrasoMedio === 1 ? 'dia' : 'dias'}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-300">Média de dias desde o vencimento dos lançamentos ainda em aberto.</p>
    </div>
  )
}
