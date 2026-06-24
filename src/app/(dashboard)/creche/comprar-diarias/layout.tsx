import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

// Só admin pode comprar/adicionar diárias.
export default async function ComprarDiariasLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single<Profile>()

  if (!profile || !profile.ativo) redirect('/login')
  if (profile.role !== 'admin') redirect('/creche')

  return <>{children}</>
}
