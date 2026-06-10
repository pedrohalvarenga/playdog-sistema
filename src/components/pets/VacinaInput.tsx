'use client'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
}

export default function VacinaInput({ label, value, onChange }: Props) {
  const isNaoVacinado = value === 'NAO_VACINADO'
  const temData = value && value !== 'NAO_VACINADO'

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(isNaoVacinado ? '' : value)}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
            !isNaoVacinado ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-500'
          }`}
        >
          Informar data
        </button>
        <button
          type="button"
          onClick={() => onChange(isNaoVacinado ? '' : 'NAO_VACINADO')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
            isNaoVacinado ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500'
          }`}
        >
          Não vacinado
        </button>
      </div>
      {!isNaoVacinado && (
        <input
          type="date"
          value={temData ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
        />
      )}
      {isNaoVacinado && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 border-2 border-red-200 text-sm text-red-600 font-medium">
          Não vacinado — sem registro
        </div>
      )}
    </div>
  )
}
