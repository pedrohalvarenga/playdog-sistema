'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Users, UserPlus, ChevronRight, Link2, Copy, Check } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'
import type { Profile } from '@/types'

export default function AdminPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      const { data } = await supabase.from('profiles').select('*').order('nome')
      setUsuarios(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administração</h1>
        <p className="text-sm text-gray-400">Gerencie usuários e configurações</p>
      </div>

      {/* Link de auto-cadastro para tutores */}
      <CopiarLinkCadastro />

      <Link href="/admin/usuarios/novo">
        <div className="flex items-center gap-4 bg-brand-purple rounded-3xl p-4 text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="font-bold">Criar usuário</p>
            <p className="text-sm opacity-80">Adicionar funcionário ao sistema</p>
          </div>
        </div>
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-gray-500" />
          <h2 className="font-bold text-gray-700">Usuários ({usuarios?.length ?? 0})</h2>
        </div>
        <div className="flex flex-col gap-2">
          {usuarios?.map(u => (
            <Link key={u.id} href={`/admin/usuarios/${u.id}`}>
              <Card className="cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-brand-purple text-sm">
                      {u.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{u.nome}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={u.role === 'admin' ? 'purple' : 'gray'}>{ROLE_LABELS[u.role]}</Badge>
                    {!u.ativo && <Badge variant="red">Inativo</Badge>}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function CopiarLinkCadastro() {
  const [copiado, setCopiado] = useState(false)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/cadastro` : ''

  function copiar() {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="bg-teal-50 border border-brand-teal/30 rounded-3xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 size={18} className="text-brand-teal" />
        <p className="font-bold text-gray-800">Link de cadastro para tutores</p>
      </div>
      <p className="text-xs text-gray-500">
        Envie este link pelo WhatsApp para o tutor se cadastrar sozinho com o pet, sem precisar de login.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white rounded-2xl px-3 py-2 border border-gray-200 overflow-hidden">
          <p className="text-xs text-gray-500 truncate">{link || 'Carregando...'}</p>
        </div>
        <button
          onClick={copiar}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-semibold text-sm transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-brand-teal text-white'}`}
        >
          {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar</>}
        </button>
      </div>
    </div>
  )
}
