'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NovoTutorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [precoPersonalizado, setPrecoPersonalizado] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('tutores').insert({
      nome,
      telefone,
      email: email || null,
      cpf: cpf || null,
      endereco: endereco || null,
      observacoes: observacoes || null,
      preco_personalizado: precoPersonalizado ? parseFloat(precoPersonalizado.replace(',', '.')) : null,
    })
    if (error) { setLoading(false); alert('Erro ao salvar'); return }
    router.push('/tutores')
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tutores" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Novo Tutor</h1>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
          <Input label="WhatsApp / Telefone" type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} required />
          <Input label="E-mail (para extrato)" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          <Input label="Preço negociado por diária (R$)" type="text" inputMode="decimal" value={precoPersonalizado} onChange={e => setPrecoPersonalizado(e.target.value)} placeholder="Deixe vazio para usar o padrão" />
          <Input label="CPF (opcional)" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
          <Input label="Endereço" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro..." />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none"
              placeholder="Informações adicionais..."
            />
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading}>
          Salvar Tutor
        </Button>
      </form>
    </div>
  )
}
