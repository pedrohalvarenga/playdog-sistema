import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import AlertaDespesasHoje from '@/components/financeiro/AlertaDespesasHoje'
import type { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || !profile.ativo) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={profile.nome} />
      <main className="pt-14 pb-24 max-w-lg mx-auto px-4">
        {children}
      </main>
      <BottomNav role={profile.role} />
      {profile.role === 'admin' && <AlertaDespesasHoje />}
    </div>
  )
}
