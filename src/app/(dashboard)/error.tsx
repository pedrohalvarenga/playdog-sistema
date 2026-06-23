'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="py-20 flex flex-col items-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center">
        <AlertTriangle size={30} className="text-red-400" />
      </div>
      <div>
        <p className="font-bold text-gray-800">Algo deu errado ao carregar</p>
        <p className="text-sm text-gray-400 mt-1">Pode ser a internet ou uma falha temporária. Tente de novo.</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2.5 rounded-2xl text-sm font-semibold"
        >
          <RotateCcw size={16} /> Tentar de novo
        </button>
        <Link href="/dashboard" className="flex items-center px-4 py-2.5 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-700">
          Início
        </Link>
      </div>
    </div>
  )
}
