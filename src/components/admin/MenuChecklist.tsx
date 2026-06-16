'use client'

import { MENUS } from '@/lib/menus'

export default function MenuChecklist({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const todos = value.length === MENUS.length

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-gray-700">Menus liberados</label>
          <p className="text-xs text-gray-400">Marque o que esta pessoa pode acessar</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(todos ? [] : MENUS.map(m => m.key))}
          className="text-xs text-brand-purple font-semibold whitespace-nowrap"
        >
          {todos ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {MENUS.map((m, i) => {
          const on = value.includes(m.key)
          const Icon = m.icon
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.iconBg}`}>
                <Icon size={18} className={m.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                <p className="text-[11px] text-gray-400 truncate">{m.sublabel}</p>
              </div>
              <span className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${on ? 'bg-brand-purple' : 'bg-gray-200'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
