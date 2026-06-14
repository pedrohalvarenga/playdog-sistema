'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Card from '@/components/ui/Card'
import { UserPlus, ChevronRight, Briefcase, Percent, BadgeDollarSign, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import type { Profile } from '@/types'
import type { Funcionario } from '@/types/funcionario'

export default function FuncionariosPage() {
  const router = useRouter()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      const { data } = await supabase.from('funcionarios').select('*').order('ativo', { ascending: false }).order('nome')
      setFuncionarios((data as Funcionario[]) ?? [])
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
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funcionários</h1>
          <p className="text-sm text-gray-400">Equipe, uniformes e comissões</p>
        </div>
      </div>

      {/* Atalho comissões do mês */}
      <Link href="/funcionarios/comissoes">
        <div className="flex items-center gap-4 bg-gradient-to-br from-brand-purple to-purple-700 rounded-3xl p-4 text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <BadgeDollarSign size={24} />
          </div>
          <div className="flex-1">
            <p className="font-bold">Comissões do mês</p>
            <p className="text-sm opacity-80">Calcular e registrar pagamentos</p>
          </div>
          <ChevronRight size={20} className="opacity-70" />
        </div>
      </Link>

      <Link href="/funcionarios/novo">
        <div className="flex items-center gap-4 bg-brand-orange rounded-3xl p-4 text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="font-bold">Cadastrar funcionário</p>
            <p className="text-sm opacity-80">Dados, uniformes, acesso e comissão</p>
          </div>
        </div>
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-gray-500" />
          <h2 className="font-bold text-gray-700">Equipe ({funcionarios.length})</h2>
        </div>

        {funcionarios.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum funcionário cadastrado</p>
            <Link href="/funcionarios/novo" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
              + Cadastrar primeiro
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {funcionarios.map(f => (
              <Link key={f.id} href={`/funcionarios/${f.id}`}>
                <Card className={`flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow ${!f.ativo ? 'opacity-60' : ''}`}>
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {f.foto_url ? (
                      <Image src={f.foto_url} alt={f.nome} width={56} height={56} className="object-cover w-full h-full" />
                    ) : (
                      <span className="font-bold text-brand-purple text-lg">{f.nome.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{f.nome}</p>
                      {f.recebe_comissao && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-700">
                          <Percent size={10} /> Comissão
                        </span>
                      )}
                      {!f.ativo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Inativo</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {f.cargo ? `${f.cargo} · ` : ''}{formatCurrency(f.salario)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
