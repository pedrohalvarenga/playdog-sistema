'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@/types'
import { ROLE_LABELS } from '@/lib/utils'

const roles: UserRole[] = ['admin', 'recepcao', 'banho_tosa', 'motorista']

export default function NovoUsuarioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<UserRole>('recepcao')
  const [erro, setErro] = useState('')

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const res = await fetch('/api/admin/criar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, role }),
    })

    const json = await res.json()
    if (!res.ok) {
      setErro(json.error ?? 'Erro ao criar usuário')
      setLoading(false)
      return
    }

    router.push('/admin')
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Criar Usuário</h1>
      </div>

      <form onSubmit={criar} className="flex flex-col gap-5">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" />

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Perfil de acesso</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-3 rounded-2xl text-sm font-semibold transition-all ${role === r ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm text-center">
            {erro}
          </div>
        )}

        <Button type="submit" size="lg" loading={loading}>
          Criar Usuário
        </Button>
      </form>
    </div>
  )
}
