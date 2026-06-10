'use client'

import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: string          // formato YYYY-MM-DD (interno)
  onChange: (value: string) => void  // retorna YYYY-MM-DD ou ''
  required?: boolean
  placeholder?: string
}

function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function toIso(display: string): string {
  const digits = display.replace(/\D/g, '')
  if (digits.length < 8) return ''
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  return `${y}-${m}-${d}`
}

function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export default function DateInput({ label, value, onChange, required, placeholder = 'DD/MM/AAAA' }: Props) {
  const [display, setDisplay] = useState(() => toDisplay(value))

  useEffect(() => {
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = mask(e.target.value)
    setDisplay(masked)
    const iso = toIso(masked)
    onChange(iso)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
      />
    </div>
  )
}
