'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft, Briefcase, Wand2 } from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@/types'
import { ROLE_LABELS } from '@/lib/utils'
import { menusPadraoRole } from '@/lib/menus'
import MenuChecklist from '@/components/admin/MenuChecklist'

const roles: UserRole[] = ['admin', 'recepcao', 'banho_tosa', 'motorista']

interface FuncOption { id: string; nome: string; email: string | null; cargo: string | null }

function gerarSenha() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  const arr = new Uint32Array(10)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 10; i++) s += chars[arr[i] % chars.length]
  return s
}

export default function NovoUsuarioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<UserRole>('recepcao')
  const [menus, setMenus] = useState<string[]>(() => menusPadraoRole('recepcao'))
  const [erro, setErro] = useState('')

  // Funcionários ainda sem login
  const [funcionarios, setFuncionarios] = useState<FuncOption[]>([])
  const [funcId, setFuncId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('funcionarios')
      .select('id, nome, email, cargo, usuario_id, ativo')
      .is('usuario_id', null)
      .order('nome')
      .then(({ data }) => {
        const lista = (data ?? []).filter((f: { ativo?: boolean }) => f.ativo !== false) as FuncOption[]
        setFuncionarios(lista)
      })
  }, [])

  // Trocar o perfil sugere o conjunto de menus daquele perfil (modelo)
  function escolherRole(r: UserRole) {
    setRole(r)
    setMenus(menusPadraoRole(r))
  }

  function escolherFuncionario(id: string) {
    setFuncId(id)
    const f = funcionarios.find(x => x.id === id)
    if (f) {
      if (f.nome) setNome(f.nome)
      if (f.email) setEmail(f.email)
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (menus.length === 0) { setErro('Marque pelo menos um menu de acesso.'); return }
    setLoading(true)

    const res = await fetch('/api/admin/criar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, role, menus, funcionario_id: funcId || null }),
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
        {/* A partir de um funcionário */}
        {funcionarios.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-brand-orange" />
              <label className="text-sm font-semibold text-orange-800">Criar a partir de um funcionário</label>
            </div>
            <p className="text-xs text-orange-700/80">Puxa nome e e-mail do cadastro e já vincula o login ao funcionário.</p>
            <select
              value={funcId}
              onChange={e => escolherFuncionario(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-orange-200 focus:border-brand-orange outline-none text-base bg-white"
            >
              <option value="">Digitar manualmente</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-700">Senha</label>
              <button type="button" onClick={() => setSenha(gerarSenha())} className="flex items-center gap-1 text-xs text-brand-purple font-semibold">
                <Wand2 size={13} /> Sugerir senha
              </button>
            </div>
            <input
              type="text"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="Mínimo 6 caracteres"
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Perfil de acesso (modelo)</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => escolherRole(r)}
                  className={`py-3 rounded-2xl text-sm font-semibold transition-all ${role === r ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">O perfil pré-marca os menus típicos. Ajuste no checklist abaixo.</p>
          </div>
        </div>

        {/* Checklist de menus */}
        <MenuChecklist value={menus} onChange={setMenus} />

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
