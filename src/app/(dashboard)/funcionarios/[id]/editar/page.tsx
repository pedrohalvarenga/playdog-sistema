'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import FuncionarioForm from '@/components/funcionarios/FuncionarioForm'
import type { Profile } from '@/types'
import type { Funcionario } from '@/types/funcionario'

export default function EditarFuncionarioPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      const { data } = await supabase.from('funcionarios').select('*').eq('id', id).single()
      setFuncionario(data as Funcionario)
      setLoading(false)
    }
    load()
  }, [router, id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  if (!funcionario) return <div className="py-6 text-center text-gray-500">Funcionário não encontrado.</div>

  return <FuncionarioForm funcionario={funcionario} />
}
