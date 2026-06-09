'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  label?: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  error?: string
}

export default function CurrencyInput({
  value,
  onChange,
  label,
  placeholder = 'R$ 0,00',
  className,
  autoFocus,
  error,
}: CurrencyInputProps) {
  const [raw, setRaw] = useState(() => value ? String(Math.round(value * 100)) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  function formatDisplay(digits: string): string {
    if (!digits) return ''
    const num = parseInt(digits, 10)
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num / 100)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setRaw(digits)
    onChange(digits ? parseInt(digits, 10) / 100 : 0)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={formatDisplay(raw)}
          onChange={handleInput}
          className={cn(
            'w-full py-3 px-4 rounded-2xl border-2 text-base outline-none transition-colors bg-white',
            error
              ? 'border-red-400 focus:border-red-500'
              : 'border-gray-200 focus:border-brand-purple',
            className
          )}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
