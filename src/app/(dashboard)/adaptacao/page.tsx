'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, PawPrint, Link2, Check, X, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useProfile } from '@/hooks/useProfile'
import type { Adaptacao, StatusAdaptacao } from '@/types/adaptacao'
import { STATUS_ADAPTACAO_LABELS, STATUS_ADAPTACAO_CORES } from '@/types/adaptacao'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { nome: string } }

function fmtHora(h?: string | null): string {
  return h ? h.slice(0, 5) : '—'
}

const FILTROS: { valor: StatusAdaptacao | 'todos'; label: string }[] = [
  { valor: 'agendada',  label: 'Agendadas' },
  { valor: 'realizada', label: 'Realizadas' },
  { valor: 'cancelada', label: 'Canceladas' },
  { valor: 'todos',     label: 'Todas' },
]

export default function AdaptacaoPage() {
  const { profile } = useProfile()
  const [adaptacoes, setAdaptacoes] = useState<Adaptacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<StatusAdaptacao | 'todos'>('agendada')
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [agindo, setAgindo] = useState<string | null>(null)

  // Modal novo agendamento
  const [showNovo, setShowNovo] = useState(false)
  const [petBusca, setPetBusca] = useState('')
  const [petSugestoes, setPetSugestoes] = useState<PetComTutor[]>([])
  const [petSelecionado, setPetSelecionado] = useState<PetComTutor | null>(null)
  const [novaData, setNovaData] = useState('')
  const [novaEntrada, setNovaEntrada] = useState('09:00')
  const [novaSaida, setNovaSaida] = useState('')
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroNovo, setErroNovo] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('adaptacoes')
      .select('*, pet:pets(id, nome, raca, porte, foto_url, restricoes, tutor_id, tutor:tutores(nome, telefone))')
      .order('data', { ascending: filtro === 'agendada' })
      .order('hora_entrada', { ascending: true })
      .limit(200)
    if (filtro !== 'todos') query = query.eq('status', filtro)
    const { data } = await query
    setAdaptacoes((data as Adaptacao[]) ?? [])
    setLoading(false)
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  // Busca de pets para o agendamento interno
  useEffect(() => {
    if (petBusca.length < 2) { setPetSugestoes([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome)')
        .eq('ativo', true)
        .or(`nome.ilike.%${petBusca.toLowerCase()}%,identificador.ilike.%${petBusca.toLowerCase()}%`)
        .limit(6)
      setPetSugestoes((data as PetComTutor[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [petBusca])

  function copiarLink() {
    const url = `${window.location.origin}/cadastro-adaptacao`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    })
  }

  async function salvarNovo() {
    if (!petSelecionado) { setErroNovo('Selecione um pet.'); return }
    if (!novaData || !novaEntrada) { setErroNovo('Informe dia e horário de entrada.'); return }
    setErroNovo(''); setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('adaptacoes').insert({
      pet_id: petSelecionado.id,
      data: novaData,
      hora_entrada: novaEntrada,
      hora_saida: novaSaida || null,
      observacoes: novaObs || null,
      status: 'agendada',
      origem: 'interno',
    })
    setSalvando(false)
    if (error) { setErroNovo(error.message); return }
    setShowNovo(false)
    setPetSelecionado(null); setPetBusca(''); setNovaData(''); setNovaEntrada('09:00'); setNovaSaida(''); setNovaObs('')
    carregar()
  }

  async function mudarStatus(id: string, status: StatusAdaptacao) {
    setAgindo(id)
    const supabase = createClient()
    await supabase.from('adaptacoes').update({ status }).eq('id', id)
    setAgindo(null)
    carregar()
  }

  const podeEditar = profile?.role === 'admin' || profile?.role === 'recepcao'
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Adaptação</h1>
        {podeEditar && (
          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1.5 bg-brand-purple text-white px-4 py-2 rounded-2xl text-sm font-semibold"
          >
            <Plus size={18} /> Novo
          </button>
        )}
      </div>

      {/* Link de cadastro */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center flex-shrink-0">
          <Link2 size={18} className="text-brand-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Link de cadastro para o tutor</p>
          <p className="text-xs text-gray-500 truncate">O tutor cadastra os dados e escolhe o dia da adaptação</p>
        </div>
        <button
          onClick={copiarLink}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            linkCopiado ? 'bg-green-500 text-white' : 'bg-brand-purple text-white'
          }`}
        >
          {linkCopiado ? <span className="flex items-center gap-1"><Check size={13} /> Copiado!</span> : 'Copiar link'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTROS.map(f => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtro === f.valor ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : adaptacoes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PawPrint size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma adaptação {filtro !== 'todos' ? STATUS_ADAPTACAO_LABELS[filtro as StatusAdaptacao].toLowerCase() : 'encontrada'}</p>
          <p className="text-xs mt-1">Use o link acima ou o botão Novo para agendar</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {adaptacoes.map(a => {
            const pet = a.pet
            const ehHoje = a.data === hoje
            return (
              <div key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${ehHoje && a.status === 'agendada' ? 'border-brand-purple' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {pet?.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
                    ) : <PawPrint size={18} className="text-brand-purple" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{pet?.nome}</p>
                      {ehHoje && a.status === 'agendada' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-brand-purple">HOJE</span>
                      )}
                      {a.origem === 'link' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-brand-orange">via link</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{pet?.tutor?.nome}{pet?.raca ? ` · ${pet.raca}` : ''}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(a.data + 'T12:00:00', 'dd/MM/yyyy')} · {fmtHora(a.hora_entrada)}
                      {a.hora_saida ? ` → ${fmtHora(a.hora_saida)}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_ADAPTACAO_CORES[a.status]}`}>
                    {STATUS_ADAPTACAO_LABELS[a.status]}
                  </span>
                </div>

                {a.observacoes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mt-2">{a.observacoes}</p>
                )}

                {podeEditar && a.status === 'agendada' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => mudarStatus(a.id, 'realizada')}
                      disabled={agindo === a.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Marcar realizada
                    </button>
                    <button
                      onClick={() => mudarStatus(a.id, 'cancelada')}
                      disabled={agindo === a.id}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal novo agendamento */}
      {showNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Nova adaptação</h2>
              <button onClick={() => setShowNovo(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>

            {/* Pet */}
            {petSelecionado ? (
              <div className="flex items-center gap-3 bg-purple-50 rounded-2xl px-4 py-3">
                <PawPrint size={18} className="text-brand-purple" />
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{petSelecionado.nome}</p>
                  <p className="text-xs text-gray-500">{petSelecionado.tutor?.nome}</p>
                </div>
                <button onClick={() => setPetSelecionado(null)} className="p-1 text-gray-400"><X size={18} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar pet já cadastrado..."
                  value={petBusca}
                  onChange={e => setPetBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
                />
                {petSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-lg z-10 overflow-hidden">
                    {petSugestoes.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setPetSelecionado(p); setPetBusca(''); setPetSugestoes([]) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                      >
                        <PawPrint size={14} className="text-brand-purple" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {p.nome}
                            {p.identificador && <span className="text-gray-400 font-normal ml-1">({p.identificador})</span>}
                          </p>
                          <p className="text-xs text-gray-500">{p.tutor?.nome}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Dia *</label>
              <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Entrada *</label>
                <input type="time" value={novaEntrada} onChange={e => setNovaEntrada(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Saída</label>
                <input type="time" value={novaSaida} onChange={e => setNovaSaida(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observações</label>
              <textarea rows={2} value={novaObs} onChange={e => setNovaObs(e.target.value)}
                placeholder="Comportamento, combinados com o tutor..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none" />
            </div>

            {erroNovo && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erroNovo}</p>}

            <button
              onClick={salvarNovo}
              disabled={salvando}
              className="w-full py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Agendar adaptação'}
            </button>
            <div className="pb-4" />
          </div>
        </div>
      )}
    </div>
  )
}
