'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import { ArrowLeft, Edit, Truck, Phone, Mail, MapPin, IdCard, MessageCircle, Power } from 'lucide-react'
import { formatCurrency } from '@/lib/financeiro'
import { whatsappUrl } from '@/lib/utils'
import { CATEGORIA_FORNECEDOR_LABELS } from '@/types/fornecedor'
import type { Profile } from '@/types'
import type { Fornecedor } from '@/types/fornecedor'

export default function FornecedorFichaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [f, setF] = useState<Fornecedor | null>(null)
  const [totalGasto, setTotalGasto] = useState(0)
  const [numDespesas, setNumDespesas] = useState(0)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
    if (profile?.role !== 'admin' && profile?.role !== 'recepcao') { router.push('/dashboard'); return }

    const [{ data }, { data: despesas }] = await Promise.all([
      supabase.from('fornecedores').select('*').eq('id', id).single(),
      supabase.from('despesas').select('valor').eq('fornecedor_id', id).eq('status', 'pago'),
    ])
    setF(data as Fornecedor)
    const ds = (despesas as { valor: number }[]) ?? []
    setTotalGasto(ds.reduce((s, d) => s + d.valor, 0))
    setNumDespesas(ds.length)
    setLoading(false)
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  async function toggleAtivo() {
    if (!f) return
    const acao = f.ativo ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${acao} ${f.nome}?`)) return
    const supabase = createClient()
    await supabase.from('fornecedores').update({ ativo: !f.ativo }).eq('id', id)
    carregar()
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!f) return <div className="py-6 text-center text-gray-500">Fornecedor não encontrado.</div>

  const linhas: { icon: React.ElementType; label: string; value: string }[] = [
    ...(f.cnpj ? [{ icon: IdCard, label: 'CNPJ', value: f.cnpj }] : []),
    ...(f.contato_nome ? [{ icon: Truck, label: 'Contato', value: f.contato_nome }] : []),
    ...(f.telefone ? [{ icon: Phone, label: 'Telefone', value: f.telefone }] : []),
    ...(f.email ? [{ icon: Mail, label: 'E-mail', value: f.email }] : []),
    ...(f.endereco ? [{ icon: MapPin, label: 'Endereço', value: f.endereco }] : []),
  ]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/fornecedores" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <Link href={`/fornecedores/${id}/editar`} className="p-2 rounded-xl text-gray-400"><Edit size={22} /></Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center gap-4 rounded-3xl p-5 text-white bg-brand-purple">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Truck size={28} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{f.nome}</h1>
          {f.categoria && <p className="text-white/80 text-sm">{CATEGORIA_FORNECEDOR_LABELS[f.categoria]}</p>}
          {!f.ativo && <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-500/80 mt-2 inline-block">Inativo</span>}
        </div>
      </div>

      {/* Total gasto */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Total já gasto (pago)</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalGasto)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Despesas</p>
          <p className="font-bold text-gray-700">{numDespesas}</p>
        </div>
      </Card>

      {/* Contato */}
      {linhas.length > 0 && (
        <Card className="divide-y divide-gray-100">
          {linhas.map((l, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <l.icon size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500 flex-1">{l.label}</span>
              <span className="text-sm font-medium text-gray-800 text-right truncate">{l.value}</span>
            </div>
          ))}
        </Card>
      )}

      {f.telefone && (
        <a href={whatsappUrl(f.telefone)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 text-white font-semibold text-sm">
          <MessageCircle size={16} /> WhatsApp
        </a>
      )}

      {f.observacoes && (
        <Card>
          <p className="text-xs text-gray-400 mb-1">Observações</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{f.observacoes}</p>
        </Card>
      )}

      <button onClick={toggleAtivo}
        className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-semibold text-sm ${
          f.ativo ? 'border-red-200 text-red-500' : 'border-green-200 text-green-600'
        }`}>
        <Power size={16} /> {f.ativo ? 'Desativar fornecedor' : 'Reativar fornecedor'}
      </button>

      <div className="pb-6" />
    </div>
  )
}
