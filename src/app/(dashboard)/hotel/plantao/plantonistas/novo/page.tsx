'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

export default function NovoPlantonistPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [valorNoite, setValorNoite] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Nome obrigatório.'); return }
    const valor = parseFloat(valorNoite.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor inválido.'); return }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('plantonistas').insert({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      valor_noite: valor,
    })
    if (error) { setErro(error.message); setSaving(false); return }
    router.push('/hotel/plantao/plantonistas')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/hotel/plantao/plantonistas" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Novo Plantonista</h1>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Nome *</label>
        <input
          type="text"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Nome completo"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Telefone</label>
        <input
          type="tel"
          value={telefone}
          onChange={e => setTelefone(e.target.value)}
          placeholder="(32) 99999-9999"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Valor por noite (R$) *
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={valorNoite}
          onChange={e => setValorNoite(e.target.value)}
          placeholder="0,00"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>
        Salvar plantonista
      </Button>
    </div>
  )
}
