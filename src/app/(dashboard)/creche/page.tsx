'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatTime, formatDate, PORTE_LABELS } from '@/lib/utils'
import { Dog, Clock, CheckCircle, Search, AlertCircle, Settings, CreditCard, AlertTriangle, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Pet, Presenca } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string } }
type PresencaComPet = Presenca & { pet: PetComTutor }

export default function CrechePage() {
  const [todosPets, setTodosPets] = useState<PetComTutor[]>([])
  const [presencasHoje, setPresencasHoje] = useState<PresencaComPet[]>([])
  const [capacidade, setCapacidade] = useState(20)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [fazendoCheckin, setFazendoCheckin] = useState<string | null>(null)
  const [hoje] = useState(() => new Date().toISOString().split('T')[0])

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: pets }, { data: presencas }, { data: config }] = await Promise.all([
      supabase
        .from('pets')
        .select('*, tutor:tutores(nome)')
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('presencas')
        .select('*, pet:pets(*, tutor:tutores(nome))')
        .eq('data', hoje),
      supabase
        .from('config_creche')
        .select('chave, valor')
        .eq('chave', 'capacidade_diaria')
        .single(),
    ])
    setTodosPets((pets as PetComTutor[]) ?? [])
    setPresencasHoje((presencas as PresencaComPet[]) ?? [])
    if (config) setCapacidade(Number(config.valor) || 20)
    setLoading(false)
  }, [hoje])

  useEffect(() => { carregar() }, [carregar])

  async function fazerCheckin(petId: string) {
    setFazendoCheckin(petId)
    const res = await fetch('/api/creche/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pet_id: petId }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Erro ao fazer check-in')
    }
    setFazendoCheckin(null)
    await carregar()
  }

  async function fazerCheckout(presencaId: string) {
    const supabase = createClient()
    await supabase
      .from('presencas')
      .update({ checkout_at: new Date().toISOString() })
      .eq('id', presencaId)
    await carregar()
  }

  // Pets com check-in hoje (sem checkout = presentes; com checkout = saíram)
  const idsComCheckin = new Set(presencasHoje.map(p => p.pet_id))
  const presentes = presencasHoje.filter(p => !p.checkout_at)
  const saidas = presencasHoje.filter(p => p.checkout_at)

  // Checklist: pets SEM check-in hoje
  const checklist = todosPets.filter(p => !idsComCheckin.has(p.id))

  const buscaLower = busca.toLowerCase()
  const checklistFiltrado = checklist.filter(p =>
    p.nome.toLowerCase().includes(buscaLower) ||
    (p.identificador ?? '').toLowerCase().includes(buscaLower) ||
    p.tutor.nome.toLowerCase().includes(buscaLower)
  )
  const presentesFiltrados = presentes.filter(p =>
    p.pet.nome.toLowerCase().includes(buscaLower) ||
    (p.pet.identificador ?? '').toLowerCase().includes(buscaLower) ||
    p.pet.tutor.nome.toLowerCase().includes(buscaLower)
  )

  const lotado = presentes.length >= capacidade

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chamada</h1>
          <p className="text-sm text-gray-400">{formatDate(hoje, "dd 'de' MMMM, yyyy")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/creche/resumo" className="p-2 rounded-xl text-gray-400 hover:text-brand-purple">
            <BarChart2 size={22} />
          </Link>
          <Link href="/creche/config" className="p-2 rounded-xl text-gray-400 hover:text-brand-purple">
            <Settings size={22} />
          </Link>
        </div>
      </div>

      {/* Contadores */}
      <div className="flex gap-3">
        <div className={`flex-1 rounded-2xl p-3 text-white text-center ${lotado ? 'bg-red-500' : 'bg-brand-purple'}`}>
          <p className="text-2xl font-bold">{presentes.length}<span className="text-base font-normal opacity-70">/{capacidade}</span></p>
          <p className="text-xs opacity-80">{lotado ? '⚠️ Lotado' : 'Presentes'}</p>
        </div>
        <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{saidas.length}</p>
          <p className="text-xs text-gray-500">Saídas hoje</p>
        </div>
        <Link href="/creche/cobranca" className="flex-1 bg-red-50 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-red-500">{todosPets.filter(p => p.saldo_diarias < 0).length}</p>
          <p className="text-xs text-red-400">Negativos</p>
        </Link>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar pet ou tutor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Presentes agora */}
          {presentesFiltrados.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Presentes agora</h2>
              <div className="flex flex-col gap-2">
                {presentesFiltrados.map(p => (
                  <Card key={p.id}>
                    <div className="flex items-center gap-3">
                      <PetAvatar pet={p.pet} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{p.pet.nome}</p>
                          {p.pet.identificador && (
                            <span className="text-xs text-gray-400">({p.pet.identificador})</span>
                          )}
                          {p.pet.saldo_diarias < 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                              <AlertCircle size={9} /> {p.pet.saldo_diarias}d
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{p.pet.tutor.nome}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-brand-teal" />
                          <span className="text-xs text-gray-400">
                            {p.checkin_at ? formatTime(p.checkin_at) : '—'}
                          </span>
                          <Badge variant="gray" className="ml-1">{PORTE_LABELS[p.pet.porte]}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <button
                          onClick={() => fazerCheckout(p.id)}
                          className="w-14 h-14 rounded-2xl bg-green-100 flex flex-col items-center justify-center text-green-700 active:bg-green-200 transition-colors"
                        >
                          <CheckCircle size={22} />
                          <span className="text-[9px] font-semibold mt-0.5">SAÍDA</span>
                        </button>
                        <Link
                          href={`/creche/comprar-diarias/${p.pet.id}`}
                          className="w-14 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-brand-purple active:bg-purple-200"
                        >
                          <CreditCard size={14} />
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Checklist — pets aguardando check-in */}
          {checklistFiltrado.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Checklist — {checklistFiltrado.length} aguardando
              </h2>
              <div className="flex flex-col gap-2">
                {checklistFiltrado.map(pet => (
                  <ChecklistItem
                    key={pet.id}
                    pet={pet}
                    loading={fazendoCheckin === pet.id}
                    onCheckin={() => fazerCheckin(pet.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Saídas do dia */}
          {saidas.length > 0 && !busca && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Saídas de hoje</h2>
              <div className="flex flex-col gap-2">
                {saidas.map(p => (
                  <Card key={p.id} className="opacity-60">
                    <div className="flex items-center gap-3">
                      <PetAvatar pet={p.pet} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-700">{p.pet.nome}</p>
                        {p.pet.identificador && <p className="text-xs text-gray-400">{p.pet.identificador}</p>}
                        <p className="text-xs text-gray-400">
                          {p.checkin_at ? formatTime(p.checkin_at) : '—'} → {p.checkout_at ? formatTime(p.checkout_at) : '—'}
                        </p>
                      </div>
                      <Badge variant="green">Saiu</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {checklistFiltrado.length === 0 && presentesFiltrados.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <Dog size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum pet encontrado</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PetAvatar({ pet, size }: { pet: PetComTutor; size: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-12 h-12' : 'w-10 h-10'
  const iconSize = size === 'md' ? 22 : 18
  return (
    <div className={`${dim} rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {pet.foto_url ? (
        <Image src={pet.foto_url} alt={pet.nome} width={48} height={48} className="object-cover w-full h-full" />
      ) : (
        <Dog size={iconSize} className="text-brand-purple" />
      )}
    </div>
  )
}

function ChecklistItem({
  pet,
  loading,
  onCheckin,
}: {
  pet: PetComTutor
  loading: boolean
  onCheckin: () => void
}) {
  const negativo = pet.saldo_diarias < 0
  const zerado = pet.saldo_diarias === 0

  return (
    <Card className={negativo ? 'border-l-4 border-red-300' : ''}>
      <div className="flex items-center gap-3">
        <PetAvatar pet={pet} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{pet.nome}</p>
            {pet.identificador && (
              <span className="text-xs text-gray-400">({pet.identificador})</span>
            )}
            {negativo && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                <AlertTriangle size={9} /> {pet.saldo_diarias}d
              </span>
            )}
            {zerado && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-600">
                0 diárias
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{pet.tutor.nome}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant="gray">{PORTE_LABELS[pet.porte]}</Badge>
            {pet.saldo_diarias > 0 && (
              <span className="text-xs text-green-600 font-semibold">{pet.saldo_diarias}d saldo</span>
            )}
          </div>
        </div>
        <button
          onClick={onCheckin}
          disabled={loading}
          className="w-16 h-14 rounded-2xl bg-brand-purple flex flex-col items-center justify-center text-white flex-shrink-0 active:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle size={20} />
              <span className="text-[9px] font-semibold mt-0.5">CHECK-IN</span>
            </>
          )}
        </button>
      </div>
    </Card>
  )
}
