import { Scissors } from 'lucide-react'

export default function BanhoTosaPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="w-20 h-20 rounded-3xl bg-brand-teal/10 flex items-center justify-center">
        <Scissors size={36} className="text-brand-teal" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Banho &amp; Tosa</h1>
        <p className="text-gray-400 mt-2 text-sm">Módulo em desenvolvimento</p>
        <p className="text-gray-300 text-xs mt-1">Em breve aqui: agendamentos, fichas e histórico</p>
      </div>
      <span className="bg-brand-teal/10 text-brand-teal text-xs font-bold px-4 py-2 rounded-full">
        Fase 2 — Em breve
      </span>
    </div>
  )
}
