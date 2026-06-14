'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Card from '@/components/ui/Card'
import {
  ArrowLeft, Edit, Percent, Shirt, IdCard, Phone, Mail, Calendar,
  ShieldCheck, BadgeDollarSign, Power,
} from 'lucide-react'
import { formatCurrency, AREA_LABELS } from '@/lib/financeiro'
import { formatDate, ROLE_LABELS } from '@/lib/utils'
import type { Profile } from '@/types'
import type { Funcionario, ComissaoRegra } from '@/types/funcionario'

export default function FuncionarioFichaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [f, setF] = useState<Funcionario | null>(null)
  const [regras, setRegras] = useState<ComissaoRegra[]>([])
  const [usuario, setUsuario] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>()
    if (profile?.role !== 'admin') { router.push('/dashboard'); return }

    const { data } = await supabase.from('funcionarios').select('*').eq('id', id).single()
    const func = data as Funcionario | null
    setF(func)
    const [{ data: rs }, usr] = await Promise.all([
      supabase.from('comissao_regras').select('*').eq('funcionario_id', id),
      func?.usuario_id
        ? supabase.from('profiles').select('*').eq('id', func.usuario_id).single()
        : Promise.resolve({ data: null }),
    ])
    setRegras((rs as ComissaoRegra[]) ?? [])
    setUsuario((usr.data as Profile) ?? null)
    setLoading(false)
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  async function toggleAtivo() {
    if (!f) return
    const acao = f.ativo ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${acao} ${f.nome}? O histórico é mantido.`)) return
    const supabase = createClient()
    await supabase.from('funcionarios').update({ ativo: !f.ativo }).eq('id', id)
    carregar()
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!f) return <div className="py-6 text-center text-gray-500">Funcionário não encontrado.</div>

  const linhasPessoais: { icon: React.ElementType; label: string; value: string }[] = [
    ...(f.cpf ? [{ icon: IdCard, label: 'CPF', value: f.cpf }] : []),
    ...(f.rg ? [{ icon: IdCard, label: 'RG', value: f.rg }] : []),
    ...(f.data_nascimento ? [{ icon: Calendar, label: 'Nascimento', value: formatDate(f.data_nascimento) }] : []),
    ...(f.telefone ? [{ icon: Phone, label: 'Telefone', value: f.telefone }] : []),
    ...(f.email ? [{ icon: Mail, label: 'E-mail', value: f.email }] : []),
    ...(f.data_admissao ? [{ icon: Calendar, label: 'Admissão', value: formatDate(f.data_admissao) }] : []),
  ]

  const temUniforme = f.tam_calca || f.tam_camisa || f.tam_sapato

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/funcionarios" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <Link href={`/funcionarios/${id}/editar`} className="p-2 rounded-xl text-gray-400"><Edit size={22} /></Link>
      </div>

      {/* Cabeçalho do funcionário */}
      <div className="flex items-center gap-4 rounded-3xl p-5 text-white bg-brand-purple">
        <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {f.foto_url ? (
            <Image src={f.foto_url} alt={f.nome} width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <span className="text-3xl font-bold">{f.nome.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{f.nome}</h1>
          {f.cargo && <p className="text-white/80 text-sm">{f.cargo}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-white/20">{formatCurrency(f.salario)}</span>
            {!f.ativo && <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-500/80">Inativo</span>}
          </div>
        </div>
      </div>

      {/* Comissões do mês */}
      <Link href="/funcionarios/comissoes">
        <Card className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <BadgeDollarSign size={20} className="text-teal-700" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Comissões do mês</p>
            <p className="text-xs text-gray-400">Ver total, extrato e registrar pagamento</p>
          </div>
        </Card>
      </Link>

      {/* Dados pessoais */}
      {linhasPessoais.length > 0 && (
        <Card className="divide-y divide-gray-100">
          {linhasPessoais.map((l, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <l.icon size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500 flex-1">{l.label}</span>
              <span className="text-sm font-medium text-gray-800 text-right">{l.value}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Uniformes */}
      {temUniforme && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Shirt size={16} className="text-gray-500" />
            <p className="font-bold text-gray-700 text-sm">Uniformes</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-2xl py-2">
              <p className="text-[10px] text-gray-400">Calça</p>
              <p className="font-bold text-gray-800">{f.tam_calca || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl py-2">
              <p className="text-[10px] text-gray-400">Camisa</p>
              <p className="font-bold text-gray-800">{f.tam_camisa || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl py-2">
              <p className="text-[10px] text-gray-400">Sapato</p>
              <p className="font-bold text-gray-800">{f.tam_sapato || '—'}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Acesso ao sistema */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-gray-500" />
          <p className="font-bold text-gray-700 text-sm">Acesso ao sistema</p>
        </div>
        {usuario ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{usuario.nome}</p>
              <p className="text-xs text-gray-400">{usuario.email}</p>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-brand-purple">
              {ROLE_LABELS[usuario.role]}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sem login vinculado.</p>
        )}
      </Card>

      {/* Comissão */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Percent size={16} className="text-teal-600" />
          <p className="font-bold text-gray-700 text-sm">Comissão</p>
        </div>
        {f.recebe_comissao && regras.length > 0 ? (
          <div className="flex flex-col gap-2">
            {regras.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-teal-50 rounded-2xl px-4 py-2.5">
                <span className="text-sm font-semibold text-teal-800">{AREA_LABELS[r.tipo]}</span>
                <span className="font-bold text-teal-700">{r.percentual}%</span>
              </div>
            ))}
          </div>
        ) : f.recebe_comissao ? (
          <p className="text-sm text-gray-400">Recebe comissão, mas nenhuma regra cadastrada ainda.</p>
        ) : (
          <p className="text-sm text-gray-400">Não recebe comissão.</p>
        )}
      </Card>

      {/* Observações */}
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
        <Power size={16} /> {f.ativo ? 'Desativar funcionário' : 'Reativar funcionário'}
      </button>

      <div className="pb-6" />
    </div>
  )
}
