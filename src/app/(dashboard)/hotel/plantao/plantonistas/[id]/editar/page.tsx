'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import type { Plantonista } from '@/types/hotel'

export default function EditarPlantonistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [valorNoite, setValorNoite] = useState('')
  const [ativo, setAtivo] = useState(true)

  useEffect(() => {
    createClient()
      .from('plantonistas')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = data as Plantonista
          setNome(p.nome)
          setTelefone(p.telefone ?? '')
          setValorNoite(p.valor_noite.toFixed(2).replace('.', ','))
          setAtivo(p.ativo)
        }
        setLoading(false)
      })
  }, [id])

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Nome obrigatório.'); return }
    const valor = parseFloat(valorNoite.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor inválido.'); return }

    setSaving(true)
    const { error } = await createClient().from('plantonistas').update({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      valor_noite: valor,
      ativo,
    }).eq('id', id)
    if (error) { setErro(error.message); setSaving(false); return }
    router.push('/hotel/plantao/plantonistas')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/hotel/plantao/plantonistas" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Editar Plantonista</h1>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Nome *</label>
        <input type="text" value={nome} onChange={e => setNome(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Telefone</label>
        <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
          placeholder="(32) 99999-9999"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor por noite (R$)</label>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={valorNoite}
          onChange={e => setValorNoite(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
      </div>

      <label className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3 cursor-pointer">
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-5 h-5 accent-brand-purple" />
        <span className="font-semibold text-gray-700">Plantonista ativo</span>
      </label>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>Salvar</Button>
    </div>
  )
}
