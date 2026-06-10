import { Car } from 'lucide-react'

export default function TaxiDogPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="w-20 h-20 rounded-3xl bg-brand-orange/10 flex items-center justify-center">
        <Car size={36} className="text-brand-orange" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Taxi Dog</h1>
        <p className="text-gray-400 mt-2 text-sm">Módulo em desenvolvimento</p>
        <p className="text-gray-300 text-xs mt-1">Em breve aqui: rotas, motoristas e agendamentos de transporte</p>
      </div>
      <span className="bg-brand-orange/10 text-brand-orange text-xs font-bold px-4 py-2 rounded-full">
        Fase 3 — Em breve
      </span>
    </div>
  )
}
