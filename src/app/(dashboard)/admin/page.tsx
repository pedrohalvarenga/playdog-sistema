import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Users, UserPlus, Settings, ChevronRight } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'
import type { Profile } from '@/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single<Profile>()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: usuarios } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')

  return (
    <div className="py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administração</h1>
        <p className="text-sm text-gray-400">Gerencie usuários e configurações</p>
      </div>

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
