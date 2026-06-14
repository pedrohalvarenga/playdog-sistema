'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FornecedorForm from '@/components/fornecedores/FornecedorForm'
import type { Profile } from '@/types'

export default function NovoFornecedorPage() {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
      if (profile?.role !== 'admin' && profile?.role !== 'recepcao') { router.push('/dashboard'); return }
      setOk(true)
    }
    load()
  }, [router])

  if (!ok) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return <FornecedorForm />
}
