import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LancamentoRapido from '@/components/financeiro/LancamentoRapido'
import type { Profile } from '@/types'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  if (!profile || !['admin', 'recepcao'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <>
      {children}
      <LancamentoRapido />
    </>
  )
}
