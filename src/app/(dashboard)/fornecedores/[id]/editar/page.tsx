'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import FornecedorForm from '@/components/fornecedores/FornecedorForm'
import type { Profile } from '@/types'
import type { Fornecedor } from '@/types/fornecedor'

export default function EditarFornecedorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
      if (profile?.role !== 'admin' && profile?.role !== 'recepcao') { router.push('/dashboard'); return }
      const { data } = await supabase.from('fornecedores').select('*').eq('id', id).single()
      setFornecedor(data as Fornecedor)
      setLoading(false)
    }
    load()
  }, [router, id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!fornecedor) return <div className="py-6 text-center text-gray-500">Fornecedor não encontrado.</div>

  return <FornecedorForm fornecedor={fornecedor} />
}
