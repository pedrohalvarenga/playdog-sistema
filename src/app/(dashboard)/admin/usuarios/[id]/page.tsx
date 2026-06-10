'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS } from '@/lib/utils'
import type { Profile, UserRole } from '@/types'

const ROLES: UserRole[] = ['admin', 'recepcao', 'banho_tosa', 'motorista']

export default function EditarUsuarioPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [usuario, setUsuario] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [role, setRole] = useState<UserRole>('recepcao')
  const [ativo, setAtivo] = useState(true)
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') { router.push('/dashboard'); return }

    const { data } = await supabase.from('profiles').select('*').eq('id', id).single<Profile>()
    if (!data) { setErro('Usuário não encontrado.'); setLoading(false); return }
    setUsuario(data)
    setNome(data.nome)
    setRole(data.role)
    setAtivo(data.ativo)
    setLoading(false)
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    if (senha && senha.length < 6) { setErro('A nova senha precisa de pelo menos 6 caracteres.'); return }

    setSalvando(true)
    const res = await fetch('/api/admin/atualizar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nome, role, ativo, senha: senha || undefined }),
    })
    const json = await res.json()
    setSalvando(false)

    if (!res.ok) { setErro(json.error ?? 'Erro ao salvar.'); return }
    setOk(true)
    setTimeout(() => router.push('/admin'), 1000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="py-6">
        <Link href="/admin" className="text-brand-purple font-semibold text-sm">← Voltar</Link>
        <p className="text-gray-500 mt-6 text-center">{erro || 'Usuário não encontrado.'}</p>
      </div>
    )
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={40} className="text-green-500" />
        </div>
        <p className="text-xl font-bold text-gray-900">Usuário atualizado!</p>
      </div>
    )
  }

  const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white'
  const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar usuário</h1>
          <p className="text-xs text-gray-400">{usuario.email}</p>
        </div>
      </div>

      <div>
        <label className={labelCls}>Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Perfil de acesso *</label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`py-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                role === r ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 text-gray-500'
              }`}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {role === 'motorista' && (
          <p className="text-xs text-gray-400 mt-2">
            Motorista vê só o transporte: rotas, nome, foto, endereço e telefone dos pets e tutores.
          </p>
        )}
      </div>

      {/* Ativo / inativo */}
      <button onClick={() => setAtivo(!ativo)}
        className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="text-left">
          <p className="font-semibold text-gray-900">Acesso ativo</p>
          <p className="text-xs text-gray-400">Desative para bloquear o login sem excluir o usuário</p>
        </div>
        <span className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ${ativo ? 'bg-green-500' : 'bg-gray-200'}`}>
          <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${ativo ? 'translate-x-5' : ''}`} />
        </span>
      </button>

      {/* Nova senha */}
      <div>
        <label className={`${labelCls} flex items-center gap-1`}>
          <KeyRound size={12} /> Nova senha (opcional)
        </label>
        <input
          type="text"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          placeholder="Deixe em branco para manter a atual"
          className={inputCls}
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Check size={18} /> Salvar alterações</>}
      </button>
    </div>
  )
}
