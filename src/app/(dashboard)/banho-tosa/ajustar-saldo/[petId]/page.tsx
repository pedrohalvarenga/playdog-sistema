'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft, AlertCircle, Dog } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'

type PetAjuste = {
  nome: string
  identificador?: string | null
  tipo_banho?: string | null
  saldo_banhos: number
  tutor: { nome: string }
}

export default function AjustarSaldoBanhoPage() {
  const params = useParams()
  const petId = params.petId as string
  const router = useRouter()
  const { profile, loading: loadingProfile } = useProfile()

  const [pet, setPet] = useState<PetAjuste | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')

  const podeAjustar = profile?.role === 'admin' || profile?.role === 'recepcao'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('pets')
        .select('nome, identificador, tipo_banho, saldo_banhos, tutor:tutores(nome)')
        .eq('id', petId)
        .single()
      setPet(data as unknown as PetAjuste)
      setLoading(false)
    }
    load()
  }, [petId])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) { alert('Motivo é obrigatório'); return }
    const qtd = parseInt(quantidade)
    if (isNaN(qtd) || qtd === 0) { alert('Informe uma quantidade diferente de zero'); return }

    setSalvando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: errAjuste } = await supabase.from('ajustes_saldo_banho').insert({
      pet_id: petId,
      quantidade: qtd,
      motivo: motivo.trim(),
      registrado_por: user?.id,
    })
    if (errAjuste) { setSalvando(false); alert('Erro ao registrar ajuste: ' + errAjuste.message); return }

    const novoSaldo = (pet?.saldo_banhos ?? 0) + qtd
    // Garante que o pet fique como cliente de pacote ao ganhar saldo
    const updates: Record<string, unknown> = { saldo_banhos: novoSaldo }
    if (novoSaldo > 0 && pet?.tipo_banho !== 'pacote') updates.tipo_banho = 'pacote'
    await supabase.from('pets').update(updates).eq('id', petId)

    router.push(`/pets/${petId}`)
  }

  if (loadingProfile || loading) {
    return <div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" /></div>
  }

  if (!podeAjustar) {
    return (
      <div className="py-20 text-center flex flex-col items-center gap-3">
        <AlertCircle size={40} className="text-red-400" />
        <p className="font-semibold text-gray-700">Acesso restrito</p>
        <Link href={`/pets/${petId}`} className="text-brand-teal text-sm font-semibold">← Voltar</Link>
      </div>
    )
  }

  const qtdNum = parseInt(quantidade) || 0
  const saldoNovo = (pet?.saldo_banhos ?? 0) + qtdNum

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/pets/${petId}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Ajustar Saldo de Banhos</h1>
      </div>

      {pet && (
        <div className="bg-brand-teal rounded-3xl p-4 mb-5 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Dog size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-lg">{pet.nome}</p>
            {pet.identificador && <p className="text-white/70 text-sm">{pet.identificador}</p>}
            <p className="text-white/70 text-sm">{(pet.tutor as { nome: string })?.nome}</p>
            <p className="text-white/90 text-sm font-semibold mt-1">
              Saldo atual: {pet.saldo_banhos ?? 0} banho{(pet.saldo_banhos ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Quantidade a ajustar
            </label>
            <p className="text-xs text-gray-400 mb-2">Use número positivo para adicionar, negativo para subtrair. Ex: +2 ou -1</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuantidade(q => String((parseInt(q) || 0) - 1))}
                className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 text-xl font-bold flex items-center justify-center flex-shrink-0"
              >−</button>
              <input
                type="number"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                required
                className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-base bg-white text-center text-xl font-bold"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => setQuantidade(q => String((parseInt(q) || 0) + 1))}
                className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 text-xl font-bold flex items-center justify-center flex-shrink-0"
              >+</button>
            </div>
          </div>

          <Input
            label="Motivo do ajuste (obrigatório)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Correção de saldo, banho cortesia, erro de lançamento..."
            required
          />

          {quantidade !== '' && qtdNum !== 0 && (
            <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${saldoNovo >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
              Saldo após ajuste: {saldoNovo} banho{saldoNovo !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <Button type="submit" size="lg" loading={salvando} className="bg-brand-teal hover:bg-teal-600">
          Confirmar Ajuste
        </Button>
      </form>
    </div>
  )
}
