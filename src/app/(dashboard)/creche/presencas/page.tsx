'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Search, Dog, ArrowLeft, Calendar, Trash2, Plus, Check, X } from 'lucide-react'
import { PORTE_LABELS } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Pet, Presenca } from '@/types'
import { hojeLocal } from '@/lib/datas'

type PetComTutor = Pet & { tutor: { nome: string } }

export default function EditarPresencasPage() {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PetComTutor[]>([])
  const [buscando, setBuscando] = useState(false)
  const [pet, setPet] = useState<PetComTutor | null>(null)

  // Busca de pet (mesma lógica do check-in)
  useEffect(() => {
    if (pet) return
    if (busca.length < 2) { setResultados([]); return }
    const timer = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data: porNome } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome)')
        .eq('ativo', true)
        .ilike('nome', `%${busca}%`)
        .limit(10)
      const { data: tutoresBusca } = await supabase
        .from('tutores')
        .select('id')
        .ilike('nome', `%${busca}%`)
        .limit(20)
      const idsTutores = tutoresBusca?.map(t => t.id) ?? []
      const { data: porTutor } = idsTutores.length > 0
        ? await supabase
            .from('pets')
            .select('*, tutor:tutores(nome)')
            .eq('ativo', true)
            .in('tutor_id', idsTutores)
            .limit(10)
        : { data: [] as typeof porNome }
      const todos = [...(porNome ?? []), ...(porTutor ?? [])]
      const unicos = todos.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
      setResultados((unicos.slice(0, 15) as PetComTutor[]) ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [busca, pet])

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar presenças</h1>
          <p className="text-xs text-gray-400">Corrigir datas, apagar ou lançar presenças manualmente</p>
        </div>
      </div>

      {!pet ? (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar pet ou tutor..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
            />
          </div>

          {buscando && (
            <div className="flex justify-center py-4">
              <span className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {resultados.map(p => (
              <button key={p.id} onClick={() => { setPet(p); setResultados([]) }} className="text-left">
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Dog size={22} className="text-brand-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{p.nome}</p>
                      <p className="text-sm text-gray-500">{p.tutor.nome}</p>
                      <Badge variant="gray" className="mt-1">{PORTE_LABELS[p.porte]}</Badge>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          {busca.length >= 2 && resultados.length === 0 && !buscando && (
            <p className="text-center py-8 text-gray-400">Nenhum pet encontrado para &quot;{busca}&quot;</p>
          )}
          {busca.length < 2 && (
            <p className="text-center text-sm text-gray-400 mt-4">Digite pelo menos 2 letras para buscar</p>
          )}
        </>
      ) : (
        <EditorPresencas pet={pet} onTrocarPet={() => { setPet(null); setBusca('') }} />
      )}
    </div>
  )
}

function EditorPresencas({ pet, onTrocarPet }: { pet: PetComTutor; onTrocarPet: () => void }) {
  const [presencas, setPresencas] = useState<Presenca[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [novaData, setNovaData] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [dataNova, setDataNova] = useState(hojeLocal())
  const [adicionando, setAdicionando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    // Últimos ~180 dias de presenças do pet
    const { data } = await supabase
      .from('presencas')
      .select('*')
      .eq('pet_id', pet.id)
      .order('data', { ascending: false })
      .limit(120)
    setPresencas((data as Presenca[]) ?? [])
    setLoading(false)
  }, [pet.id])

  useEffect(() => { carregar() }, [carregar])

  async function salvarData(presencaId: string) {
    if (!novaData) return
    setSalvando(presencaId)
    const supabase = createClient()
    const { error } = await supabase
      .from('presencas')
      .update({ data: novaData })
      .eq('id', presencaId)
    if (error) alert(`Erro ao salvar: ${error.message}`)
    setEditando(null)
    await carregar()
    setSalvando(null)
  }

  async function apagar(presencaId: string, data: string) {
    if (!confirm(`Apagar a presença de ${formatDate(data, 'dd/MM/yyyy')}? A diária será devolvida ao saldo.`)) return
    setSalvando(presencaId)
    const res = await fetch('/api/creche/checkin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presenca_id: presencaId }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Erro ao apagar')
    }
    await carregar()
    setSalvando(null)
  }

  async function adicionar() {
    if (!dataNova) return
    if (presencas.some(p => p.data === dataNova)) {
      alert('Já existe uma presença nessa data.')
      return
    }
    setAdicionando(true)
    const res = await fetch('/api/creche/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pet_id: pet.id, data: dataNova }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Erro ao adicionar')
    }
    await carregar()
    setAdicionando(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho do pet selecionado */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Dog size={22} className="text-brand-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{pet.nome}</p>
            <p className="text-sm text-gray-500">{pet.tutor.nome}</p>
          </div>
          <button onClick={onTrocarPet} className="text-xs text-brand-purple font-semibold px-2 py-1">
            Trocar pet
          </button>
        </div>
      </Card>

      {/* Adicionar presença manual */}
      <Card>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Plus size={12} /> Lançar presença manualmente
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={dataNova}
            max={hojeLocal()}
            onChange={e => setDataNova(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          />
          <Button size="sm" onClick={adicionar} loading={adicionando}>Adicionar</Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Desconta 1 diária do saldo, igual a um check-in normal.</p>
      </Card>

      {/* Lista de presenças */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Calendar size={12} /> Presenças registradas ({presencas.length})
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : presencas.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhuma presença registrada para este pet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {presencas.map(p => (
              <Card key={p.id}>
                {editando === p.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={novaData}
                      max={hojeLocal()}
                      onChange={e => setNovaData(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border-2 border-brand-purple outline-none text-sm bg-white"
                    />
                    <button
                      onClick={() => salvarData(p.id)}
                      disabled={salvando === p.id}
                      className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700 active:bg-green-200 disabled:opacity-50"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{formatDate(p.data, "dd/MM/yyyy (EEEE)")}</p>
                      <p className="text-xs text-gray-400">
                        {p.checkin_at ? formatDate(p.checkin_at, 'HH:mm') : '—'}
                        {' → '}
                        {p.checkout_at ? formatDate(p.checkout_at, 'HH:mm') : 'presente'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditando(p.id); setNovaData(p.data) }}
                      className="text-xs text-brand-purple font-semibold px-3 py-2 rounded-xl bg-purple-50 active:bg-purple-100"
                    >
                      Corrigir data
                    </button>
                    <button
                      onClick={() => apagar(p.id, p.data)}
                      disabled={salvando === p.id}
                      className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 active:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
