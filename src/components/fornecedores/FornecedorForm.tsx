'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getEmpresaId } from '@/lib/empresa'
import { CATEGORIA_FORNECEDOR_LABELS } from '@/types/fornecedor'
import type { Fornecedor, CategoriaFornecedor } from '@/types/fornecedor'

const CATEGORIAS = Object.keys(CATEGORIA_FORNECEDOR_LABELS) as CategoriaFornecedor[]

export default function FornecedorForm({ fornecedor }: { fornecedor?: Fornecedor }) {
  const router = useRouter()
  const editId = fornecedor?.id
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState(fornecedor?.nome ?? '')
  const [cnpj, setCnpj] = useState(fornecedor?.cnpj ?? '')
  const [categoria, setCategoria] = useState<CategoriaFornecedor | ''>(fornecedor?.categoria ?? '')
  const [contatoNome, setContatoNome] = useState(fornecedor?.contato_nome ?? '')
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '')
  const [email, setEmail] = useState(fornecedor?.email ?? '')
  const [endereco, setEndereco] = useState(fornecedor?.endereco ?? '')
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes ?? '')

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome / razão social.'); return }
    setErro(''); setLoading(true)
    const supabase = createClient()

    const dados = {
      nome: nome.trim(),
      cnpj: cnpj || null,
      categoria: categoria || null,
      contato_nome: contatoNome || null,
      telefone: telefone || null,
      email: email || null,
      endereco: endereco || null,
      observacoes: observacoes || null,
    }

    let id = editId
    if (editId) {
      const { error } = await supabase.from('fornecedores').update(dados).eq('id', editId)
      if (error) { setLoading(false); setErro(error.message); return }
    } else {
      const empresaId = await getEmpresaId(supabase)
      const { data, error } = await supabase.from('fornecedores')
        .insert({ ...dados, empresa_id: empresaId, ativo: true }).select('id').single()
      if (error || !data) { setLoading(false); setErro(error?.message ?? 'Erro ao salvar.'); return }
      id = data.id
    }

    router.push(id ? `/fornecedores/${id}` : '/fornecedores')
    router.refresh()
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={editId ? `/fornecedores/${editId}` : '/fornecedores'} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar fornecedor' : 'Novo fornecedor'}</h1>
      </div>

      <div className="flex flex-col gap-5">
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <Input label="Nome / Razão social" value={nome} onChange={e => setNome(e.target.value)} required />
          <Input label="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Categoria / o que faz</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaFornecedor)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
              <option value="">Selecione...</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{CATEGORIA_FORNECEDOR_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Contato</h2>
          <Input label="Nome do contato" value={contatoNome} onChange={e => setContatoNome(e.target.value)} placeholder="Com quem falamos" />
          <Input label="Telefone / WhatsApp" type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(32) 99999-9999" />
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Endereço" value={endereco} onChange={e => setEndereco(e.target.value)} />
        </section>

        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Observações</h2>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none"
            placeholder="Condições de pagamento, prazos, comentários..." />
        </section>

        {erro && <p className="text-sm text-red-500 text-center bg-red-50 rounded-2xl py-3">{erro}</p>}

        <Button size="lg" onClick={salvar} loading={loading}>
          {editId ? 'Salvar alterações' : 'Cadastrar fornecedor'}
        </Button>
      </div>
    </div>
  )
}
