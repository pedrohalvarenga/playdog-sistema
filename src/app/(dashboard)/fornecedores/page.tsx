'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import { Plus, ChevronRight, Search, Truck, Phone } from 'lucide-react'
import { CATEGORIA_FORNECEDOR_LABELS } from '@/types/fornecedor'
import type { Profile } from '@/types'
import type { Fornecedor } from '@/types/fornecedor'

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function FornecedoresPage() {
  const router = useRouter()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
      if (profile?.role !== 'admin' && profile?.role !== 'recepcao') { router.push('/dashboard'); return }
      const { data } = await supabase.from('fornecedores').select('*').order('ativo', { ascending: false }).order('nome')
      setFornecedores((data as Fornecedor[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const filtrados = useMemo(() => {
    if (busca.trim().length < 1) return fornecedores
    const q = normalizar(busca)
    return fornecedores.filter(f =>
      normalizar(f.nome).includes(q) ||
      normalizar(f.contato_nome ?? '').includes(q) ||
      normalizar(f.categoria ? CATEGORIA_FORNECEDOR_LABELS[f.categoria] : '').includes(q)
    )
  }, [fornecedores, busca])

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-sm text-gray-400">Contatos e parceiros</p>
        </div>
        <Link href="/fornecedores/novo"
          className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold active:scale-95">
          <Plus size={18} /> Novo
        </Link>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, contato ou categoria..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Truck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{fornecedores.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum fornecedor encontrado'}</p>
          {fornecedores.length === 0 && (
            <Link href="/fornecedores/novo" className="text-brand-purple text-sm font-semibold mt-2 inline-block">
              + Cadastrar primeiro
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(f => (
            <Link key={f.id} href={`/fornecedores/${f.id}`}>
              <Card className={`flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow ${!f.ativo ? 'opacity-60' : ''}`}>
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Truck size={20} className="text-brand-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 truncate">{f.nome}</p>
                    {!f.ativo && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Inativo</span>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {f.categoria ? CATEGORIA_FORNECEDOR_LABELS[f.categoria] : 'Sem categoria'}
                    {f.telefone && <span className="inline-flex items-center gap-1 ml-1"><Phone size={11} /> {f.telefone}</span>}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
