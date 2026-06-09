'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatTime, formatDate, PLANO_LABELS, PORTE_LABELS } from '@/lib/utils'
import { Dog, Clock, CheckCircle, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import type { Presenca, Pet } from '@/types'

interface PresencaComPet extends Presenca {
  pet: Pet & { tutor: { nome: string; telefone: string } }
}

export default function CrechePage() {
  const [presencas, setPresencas] = useState<PresencaComPet[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [hoje] = useState(() => new Date().toISOString().split('T')[0])

  async function carregar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('presencas')
      .select(`*, pet:pets(*, tutor:tutores(nome, telefone))`)
      .eq('data', hoje)
      .order('checkin_at', { ascending: false })

    setPresencas((data as PresencaComPet[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function checkout(presencaId: string) {
    const supabase = createClient()
    await supabase
      .from('presencas')
      .update({ checkout_at: new Date().toISOString() })
      .eq('id', presencaId)
    await carregar()
  }

  const filtradas = presencas.filter(p =>
    p.pet.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.pet.tutor.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const presentes = filtradas.filter(p => !p.checkout_at)
  const saidas = filtradas.filter(p => p.checkout_at)

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creche</h1>
          <p className="text-sm text-gray-400">{formatDate(hoje, "dd 'de' MMMM, yyyy")}</p>
        </div>
        <Link href="/creche/checkin">
          <Button size="sm" variant="secondary">
            <Plus size={18} /> Check-in
          </Button>
        </Link>
      </div>

      {/* Contador */}
      <div className="flex gap-3">
        <div className="flex-1 bg-brand-purple rounded-2xl p-3 text-white text-center">
          <p className="text-2xl font-bold">{presentes.length}</p>
          <p className="text-xs opacity-80">Presentes</p>
        </div>
        <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{saidas.length}</p>
          <p className="text-xs text-gray-500">Saídas hoje</p>
        </div>
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
          {/* Pets presentes */}
          {presentes.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Na creche agora</h2>
              <div className="flex flex-col gap-2">
                {presentes.map(p => (
                  <Card key={p.id}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Dog size={22} className="text-brand-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{p.pet.nome}</p>
                          <Badge variant="gray">{PORTE_LABELS[p.pet.porte]}</Badge>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{p.pet.tutor.nome}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={12} className="text-brand-teal" />
                          <span className="text-xs text-gray-400">
                            Entrada: {p.checkin_at ? formatTime(p.checkin_at) : '—'}
                          </span>
                          <Badge variant="purple" className="ml-1">{PLANO_LABELS[p.pet.plano]}</Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => checkout(p.id)}
                        className="w-14 h-14 rounded-2xl bg-green-100 flex flex-col items-center justify-center text-green-700 flex-shrink-0 active:bg-green-200 transition-colors"
                      >
                        <CheckCircle size={22} />
                        <span className="text-[9px] font-semibold mt-0.5">SAÍDA</span>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Saídas do dia */}
          {saidas.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Saídas de hoje</h2>
              <div className="flex flex-col gap-2">
                {saidas.map(p => (
                  <Card key={p.id} className="opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Dog size={18} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-700">{p.pet.nome}</p>
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

          {filtradas.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Dog size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum pet na creche hoje</p>
              <p className="text-sm">Faça o check-in do primeiro pet</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
