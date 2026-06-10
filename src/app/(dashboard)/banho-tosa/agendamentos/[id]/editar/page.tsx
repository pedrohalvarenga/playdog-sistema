'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Car } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import type { AgendamentoBanhoTosa } from '@/types/banho_tosa'

export default function EditarAgendamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const [data, setData] = useState('')
  const [horaChegada, setHoraChegada] = useState('')
  const [horaSaida, setHoraSaida] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [taxiDog, setTaxiDog] = useState(false)
  const [taxiTipo, setTaxiTipo] = useState<'buscar' | 'levar' | 'ambos'>('ambos')
  const [taxiEndereco, setTaxiEndereco] = useState('')
  const [valorTaxi, setValorTaxi] = useState('')
  const [petId, setPetId] = useState('')

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: ag } = await supabase
      .from('agendamentos_banho_tosa')
      .select('*')
      .eq('id', id)
      .single<AgendamentoBanhoTosa>()
    if (!ag) return
    setData(ag.data)
    setHoraChegada(ag.hora_chegada.slice(0, 5))
    setHoraSaida(ag.hora_saida_prevista ? ag.hora_saida_prevista.slice(0, 5) : '')
    setDescricao(ag.descricao_servico)
    setValorServico(ag.valor_servico != null ? ag.valor_servico.toFixed(2).replace('.', ',') : '')
    setObservacoes(ag.observacoes ?? '')
    setTaxiDog(ag.taxi_dog)
    setTaxiTipo(ag.taxi_tipo ?? 'ambos')
    setTaxiEndereco(ag.taxi_endereco ?? '')
    setValorTaxi(ag.valor_taxi != null ? ag.valor_taxi.toFixed(2).replace('.', ',') : '')
    setPetId(ag.pet_id)
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setErro('')
    if (!data || !horaChegada || !descricao.trim()) {
      setErro('Preencha os campos obrigatórios.')
      return
    }
    if (taxiDog && !taxiEndereco.trim()) {
      setErro('Informe o endereço para o Taxi Dog.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    await supabase.from('agendamentos_banho_tosa').update({
      data,
      hora_chegada: horaChegada,
      hora_saida_prevista: horaSaida || null,
      descricao_servico: descricao.trim(),
      valor_servico: valorServico ? parseFloat(valorServico.replace(',', '.')) : null,
      observacoes: observacoes.trim() || null,
      taxi_dog: taxiDog,
      taxi_tipo: taxiDog ? taxiTipo : null,
      taxi_endereco: taxiDog ? taxiEndereco.trim() : null,
      valor_taxi: taxiDog && valorTaxi ? parseFloat(valorTaxi.replace(',', '.')) : null,
    }).eq('id', id)

    // Recria registros de transporte
    await supabase.from('transportes').delete().eq('origem_id', id)
    if (taxiDog) {
      const tipos = taxiTipo === 'ambos' ? (['buscar', 'levar'] as const) : ([taxiTipo] as const)
      await supabase.from('transportes').insert(
        tipos.map(tipo => ({
          origem: 'banho_tosa',
          origem_id: id,
          pet_id: petId,
          data,
          horario: tipo === 'buscar' ? horaChegada : (horaSaida || horaChegada),
          tipo,
          endereco: taxiEndereco.trim(),
          status: 'pendente',
        }))
      )
    }

    router.push(`/banho-tosa/agendamentos/${id}`)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href={`/banho-tosa/agendamentos/${id}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Editar Agendamento</h1>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Descrição do serviço *</label>
        <input
          type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder="Ex: banho + tosa higiênica, máquina 2"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data *</label>
        <input
          type="date" value={data} onChange={e => setData(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Chegada *</label>
          <input
            type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Saída prevista</label>
          <input
            type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do serviço (R$)</label>
        <input
          type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
          value={valorServico} onChange={e => setValorServico(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white"
        />
      </div>

      {/* Taxi Dog */}
      <div className="bg-orange-50 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car size={20} className="text-brand-orange" />
            <span className="font-semibold text-gray-800">Taxi Dog</span>
          </div>
          <button type="button" onClick={() => setTaxiDog(t => !t)}
            className={`w-12 h-6 rounded-full transition-colors relative ${taxiDog ? 'bg-brand-orange' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${taxiDog ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {taxiDog && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {(['buscar', 'levar', 'ambos'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTaxiTipo(t)}
                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      taxiTipo === t ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-gray-200 text-gray-500'
                    }`}>
                    {t === 'buscar' ? 'Buscar' : t === 'levar' ? 'Levar' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Endereço</label>
              <input
                type="text" placeholder="Endereço completo"
                value={taxiEndereco} onChange={e => setTaxiEndereco(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor do Taxi Dog (R$)</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                value={valorTaxi} onChange={e => setValorTaxi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm bg-white"
              />
            </div>
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observações</label>
        <textarea
          rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)}
          placeholder="Comportamento, medicação, preferências..."
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>
        Salvar alterações
      </Button>
    </div>
  )
}
