import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

// Motorista não acessa a creche — o acesso dele é só ao transporte.
export default async function CrecheLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || !profile.ativo) redirect('/login')
  if (profile.role === 'motorista') redirect('/transportes')

  return <>{children}</>
}
