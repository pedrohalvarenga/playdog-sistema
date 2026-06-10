'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, Car, MapPin, Phone, Plus, X, Search,
  Check, Route, Fuel, Wrench, FileText, RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate, formatTime } from '@/lib/utils'
import {
  STATUS_TRANSP_LABELS, STATUS_TRANSP_CORES, STATUS_ROTA_LABELS, STATUS_ROTA_CORES,
  ORIGEM_LABELS, trechoDaRota, formatKm, formatDuracao,
} from '@/lib/transporte'
import type { Transporte, Rota, TipoRota, MeioTransporte } from '@/types/transporte'
import type { Pet } from '@/types'
import { useProfile } from '@/hooks/useProfile'

type PetComTutor = Pet & { tutor: { nome: string; telefone: string | null; endereco: string | null } }

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TransportesPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const hoje = toLocalDate(new Date())
  const [data, setData] = useState(hoje)
  const [tab, setTab] = useState<TipoRota>(() => new Date().getHours() < 12 ? 'coleta' : 'entrega')
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Modal adicionar passageiro
  const [modalAdd, setModalAdd] = useState(false)
  const [petBusca, setPetBusca] = useState('')
  const [petSugestoes, setPetSugestoes] = useState<PetComTutor[]>([])
  const [petSel, setPetSel] = useState<PetComTutor | null>(null)
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [origem, setOrigem] = useState<'creche' | 'hotel'>('creche')
  const [meioIda, setMeioIda] = useState<MeioTransporte>('playdog')
  const [meioVolta, setMeioVolta] = useState<MeioTransporte>('playdog')
  const [salvando, setSalvando] = useState(false)
  const [erroAdd, setErroAdd] = useState('')

  const perfilCarregado = profile != null
  const isMotorista = profile?.role === 'motorista'
  const podeEditar = profile?.role === 'admin' || profile?.role === 'recepcao'

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: rows }, { data: rs }] = await Promise.all([
      supabase
        .from('transportes')
        .select('*, pet:pets_rota(id, nome, identificador, foto_url, tutor_id, tutor:tutores_rota(nome, telefone, whatsapp, endereco))')
        .eq('data', data)
        .not('status', 'eq', 'cancelado')
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('horario'),
      supabase.from('rotas').select('*').eq('data', data),
    ])
    setTransportes((rows as Transporte[]) ?? [])
    setRotas((rs as Rota[]) ?? [])
    setLoading(false)
  }, [data])

  useEffect(() => { carregar() }, [carregar])

  // Busca de pets (modal)
  useEffect(() => {
    if (petBusca.length < 2) { setPetSugestoes([]); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data: pets } = await supabase
        .from('pets')
        .select('*, tutor:tutores(nome, telefone, endereco)')
        .eq('ativo', true)
        .or(`nome.ilike.%${petBusca.toLowerCase()}%,identificador.ilike.%${petBusca.toLowerCase()}%`)
        .limit(8)
      setPetSugestoes((pets as PetComTutor[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [petBusca])

  function abrirModal() {
    setPetSel(null); setPetBusca(''); setEndereco(''); setTelefone('')
    setOrigem('creche'); setMeioIda('playdog'); setMeioVolta('playdog')
    setErroAdd(''); setModalAdd(true)
  }

  function selecionarPet(pet: PetComTutor) {
    setPetSel(pet)
    setPetBusca('')
    setPetSugestoes([])
    setEndereco(pet.tutor?.endereco ?? '')
    setTelefone(pet.tutor?.telefone ?? '')
  }

  // Padrão: mesmo meio nos dois trechos — mudar a ida espelha na volta
  function trocarMeioIda(m: MeioTransporte) {
    setMeioIda(m)
    setMeioVolta(m)
  }

  async function adicionarPassageiro() {
    setErroAdd('')
    if (!petSel) { setErroAdd('Selecione um pet.'); return }
    if (!endereco.trim()) { setErroAdd('Informe o endereço.'); return }
    setSalvando(true)
    const supabase = createClient()
    const base = {
      origem,
      origem_id: null,
      pet_id: petSel.id,
      data,
      endereco: endereco.trim(),
      telefone: telefone.trim() || null,
      status: 'pendente',
    }
    const { error } = await supabase.from('transportes').insert([
      { ...base, tipo: 'buscar', meio: meioIda },
      { ...base, tipo: 'levar', meio: meioVolta },
    ])
    setSalvando(false)
    if (error) { setErroAdd(error.message); return }
    setModalAdd(false)
    await carregar()
  }

  // Troca de meio em 1 toque no card
  async function toggleMeio(t: Transporte) {
    if (!podeEditar || t.status !== 'pendente') return
    const novo = t.meio === 'playdog' ? 'tutor' : 'playdog'
    const supabase = createClient()
    await supabase.from('transportes')
      .update({ meio: novo, rota_id: null, ordem: null })
      .eq('id', t.id)
    await carregar()
  }

  async function removerTrecho(t: Transporte) {
    if (!confirm(`Remover ${t.pet?.nome ?? 'pet'} (${t.tipo === 'buscar' ? 'ida' : 'volta'}) da lista?`)) return
    const supabase = createClient()
    await supabase.from('transportes').delete().eq('id', t.id)
    await carregar()
  }

  // Check de recebimento/entrega dos pets que vêm/vão pelo tutor (recepção)
  async function checkTutor(t: Transporte, desfazer = false) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('transportes').update(desfazer
      ? { status: 'pendente', concluido_em: null, concluido_por: null }
      : { status: 'concluido', concluido_em: new Date().toISOString(), concluido_por: user?.id }
    ).eq('id', t.id)
    await carregar()
  }

  async function gerarRota(tipo: TipoRota) {
    setGerando(true)
    setAviso('')
    const res = await fetch('/api/transporte/gerar-rota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, tipo }),
    })
    const json = await res.json()
    setGerando(false)
    if (!res.ok) { setAviso(json.error ?? 'Erro ao gerar rota.'); return }
    if (json.aviso) setAviso(json.aviso)
    await carregar()
    if (json.rotaId) router.push(`/transportes/rota/${json.rotaId}`)
  }

  const navData = (delta: number) => {
    const d = new Date(data + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setData(toLocalDate(d))
  }

  // Espera o perfil para decidir entre visão da recepção e do motorista
  if (!perfilCarregado) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    )
  }

  const trecho = trechoDaRota(tab)
  const doTab = transportes.filter(t => t.tipo === trecho)
  const carro = doTab.filter(t => t.meio === 'playdog')
  const peloTutor = doTab.filter(t => t.meio === 'tutor')
  const rota = rotas.find(r => r.tipo === tab) ?? null
  const concluidosCarro = carro.filter(t => t.status === 'concluido').length

  // ── Visão do motorista: rotas de hoje ──────────────────────
  if (isMotorista) {
    const rotasHoje = rotas
    return (
      <div className="py-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rotas do Dia</h1>
          <p className="text-sm text-gray-400 capitalize">{formatDate(data + 'T12:00:00', "EEEE, dd 'de' MMMM")}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
          </div>
        ) : rotasHoje.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Route size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma rota gerada para hoje</p>
            <p className="text-xs mt-1">A recepção monta a lista e gera a rota</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(['coleta', 'entrega'] as TipoRota[]).map(tipo => {
              const r = rotasHoje.find(x => x.tipo === tipo)
              if (!r) return null
              const paradas = transportes.filter(t => t.rota_id === r.id)
              const feitas = paradas.filter(t => t.status === 'concluido').length
              return (
                <Link key={r.id} href={`/transportes/rota/${r.id}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 active:bg-gray-50">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tipo === 'coleta' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                    <Car size={26} className={tipo === 'coleta' ? 'text-blue-500' : 'text-brand-purple'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{tipo === 'coleta' ? 'Coleta' : 'Entrega'}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_ROTA_CORES[r.status]}`}>
                        {STATUS_ROTA_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {feitas} de {paradas.length} parada{paradas.length !== 1 ? 's' : ''}
                      {r.distancia_total_km != null && ` · ${formatKm(r.distancia_total_km)}`}
                      {r.duracao_estimada_min != null && ` · ${formatDuracao(r.duracao_estimada_min)}`}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-gray-300" />
                </Link>
              )
            })}
          </div>
        )}

        <Link href="/transportes/abastecimento"
          className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto py-4 rounded-2xl bg-brand-orange text-white font-bold text-center shadow-lg flex items-center justify-center gap-2">
          <Fuel size={20} /> ⛽ Abastecimento
        </Link>
      </div>
    )
  }

  // ── Visão da recepção: passageiros do dia ──────────────────
  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transporte</h1>
          <p className="text-sm text-gray-400">Passageiros do dia · Taxi Dog</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/transportes/abastecimento" className="p-2.5 rounded-xl bg-orange-100 text-brand-orange" title="Registrar abastecimento">
            <Fuel size={18} />
          </Link>
          <Link href="/transportes/relatorio" className="p-2.5 rounded-xl bg-gray-100 text-gray-500" title="Relatório por tutor">
            <FileText size={18} />
          </Link>
          <Link href="/transportes/veiculo" className="p-2.5 rounded-xl bg-gray-100 text-gray-500" title="Painel do veículo">
            <Wrench size={18} />
          </Link>
        </div>
      </div>

      {/* Navegação dia */}
      <div className="flex items-center justify-between">
        <button onClick={() => navData(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-800">
          {data === hoje ? 'Hoje' : formatDate(data + 'T12:00:00', "EEE, dd 'de' MMMM")}
        </p>
        <button onClick={() => navData(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Tabs Coleta / Entrega */}
      <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
        {(['coleta', 'entrega'] as TipoRota[]).map(tipo => {
          const n = transportes.filter(t => t.tipo === trechoDaRota(tipo)).length
          return (
            <button key={tipo} onClick={() => setTab(tipo)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === tipo ? 'bg-white shadow text-brand-orange' : 'text-gray-500'}`}>
              {tipo === 'coleta' ? '🌅 Coleta' : '🌇 Entrega'}{n > 0 && ` (${n})`}
            </button>
          )
        })}
      </div>

      {aviso && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-4 py-3">{aviso}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Card da rota */}
          {carro.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route size={18} className="text-brand-purple" />
                  <p className="font-bold text-gray-900 text-sm">Rota da {tab}</p>
                  {rota && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_ROTA_CORES[rota.status]}`}>
                      {STATUS_ROTA_LABELS[rota.status]}
                    </span>
                  )}
                </div>
                {rota && (
                  <p className="text-xs text-gray-400">{concluidosCarro} de {carro.length}</p>
                )}
              </div>

              {rota && (rota.distancia_total_km != null || rota.duracao_estimada_min != null) && (
                <p className="text-xs text-gray-500">
                  {formatKm(rota.distancia_total_km)} · {formatDuracao(rota.duracao_estimada_min)} estimados
                  {rota.otimizada ? ' · otimizada com trânsito' : ''}
                </p>
              )}

              <div className="flex gap-2">
                {podeEditar && (!rota || rota.status === 'planejada') && (
                  <button onClick={() => gerarRota(tab)} disabled={gerando}
                    className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {gerando
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <>{rota ? <RotateCcw size={15} /> : <Route size={15} />} {rota ? 'Recalcular rota' : 'Gerar rota'}</>}
                  </button>
                )}
                {rota && (
                  <Link href={`/transportes/rota/${rota.id}`}
                    className="flex-1 py-2.5 rounded-xl border-2 border-purple-200 text-brand-purple font-semibold text-sm text-center">
                    Ver rota
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Lista: vão pelo carro */}
          {doTab.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Car size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum passageiro na {tab} deste dia</p>
              <p className="text-xs mt-1">Banho &amp; tosa com taxi dog entra sozinho. Creche e hotel: adicione abaixo.</p>
            </div>
          ) : (
            <>
              {carro.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    🚐 Nosso transporte ({carro.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {carro.map(t => (
                      <PassageiroCard key={t.id} t={t} tab={tab} podeEditar={podeEditar}
                        onToggleMeio={toggleMeio} onRemover={removerTrecho} onCheck={checkTutor} />
                    ))}
                  </div>
                </div>
              )}

              {peloTutor.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    👤 {tab === 'coleta' ? 'Tutor traz' : 'Tutor busca'} ({peloTutor.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {peloTutor.map(t => (
                      <PassageiroCard key={t.id} t={t} tab={tab} podeEditar={podeEditar}
                        onToggleMeio={toggleMeio} onRemover={removerTrecho} onCheck={checkTutor} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Adicionar passageiro */}
          {podeEditar && (
            <button onClick={abrirModal}
              className="py-3.5 rounded-2xl border-2 border-dashed border-orange-300 text-brand-orange font-semibold text-sm flex items-center justify-center gap-2">
              <Plus size={18} /> Adicionar passageiro
            </button>
          )}
        </>
      )}

      {/* Modal adicionar passageiro */}
      {modalAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Adicionar passageiro</h2>
              <button onClick={() => setModalAdd(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>

            {/* Pet */}
            {petSel ? (
              <div className="flex items-center gap-3 bg-orange-50 rounded-2xl px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  {petSel.foto_url
                    ? <img src={petSel.foto_url} alt={petSel.nome} className="w-full h-full object-cover" />
                    : <span className="text-lg">🐾</span>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">
                    {petSel.nome}
                    {petSel.identificador && <span className="text-gray-400 font-normal text-sm ml-1">({petSel.identificador})</span>}
                  </p>
                  <p className="text-xs text-gray-500">{petSel.tutor?.nome}</p>
                </div>
                <button onClick={() => setPetSel(null)} className="p-1 text-gray-400"><X size={18} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  placeholder="Nome ou identificador do pet..."
                  value={petBusca}
                  onChange={e => setPetBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm"
                />
                {petSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-lg z-10 overflow-hidden">
                    {petSugestoes.map(pet => (
                      <button key={pet.id} onClick={() => selecionarPet(pet)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                        <span>🐾</span>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {pet.nome}
                            {pet.identificador && <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>}
                          </p>
                          <p className="text-xs text-gray-500">{pet.tutor?.nome}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Endereço *</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço do tutor"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Telefone do tutor</label>
              <input value={telefone} onChange={e => setTelefone(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Origem</label>
              <div className="grid grid-cols-2 gap-2">
                {(['creche', 'hotel'] as const).map(o => (
                  <button key={o} onClick={() => setOrigem(o)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${origem === o ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-gray-200 text-gray-500'}`}>
                    {ORIGEM_LABELS[o]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Ida (coleta de manhã)</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => trocarMeioIda('playdog')}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${meioIda === 'playdog' ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-gray-200 text-gray-500'}`}>
                  🚐 Nosso transporte
                </button>
                <button onClick={() => trocarMeioIda('tutor')}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${meioIda === 'tutor' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 text-gray-500'}`}>
                  👤 Tutor traz
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Volta (entrega à tarde)</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMeioVolta('playdog')}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${meioVolta === 'playdog' ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-gray-200 text-gray-500'}`}>
                  🚐 Nosso transporte
                </button>
                <button onClick={() => setMeioVolta('tutor')}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${meioVolta === 'tutor' ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 text-gray-500'}`}>
                  👤 Tutor busca
                </button>
              </div>
            </div>

            {erroAdd && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erroAdd}</p>}

            <button onClick={adicionarPassageiro} disabled={salvando}
              className="py-4 rounded-2xl bg-brand-orange text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Plus size={18} /> Adicionar à lista</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PassageiroCard({
  t, tab, podeEditar, onToggleMeio, onRemover, onCheck,
}: {
  t: Transporte
  tab: TipoRota
  podeEditar: boolean
  onToggleMeio: (t: Transporte) => void
  onRemover: (t: Transporte) => void
  onCheck: (t: Transporte, desfazer?: boolean) => void
}) {
  const pet = t.pet
  const tutor = pet?.tutor
  const editavel = podeEditar && t.status === 'pendente'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {pet?.foto_url
            ? <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
            : <span className="text-xl">🐾</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">
              {pet?.nome ?? 'Pet'}
              {pet?.identificador && <span className="text-gray-400 font-normal ml-1">({pet.identificador})</span>}
            </p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TRANSP_CORES[t.status]}`}>
              {STATUS_TRANSP_LABELS[t.status]}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {ORIGEM_LABELS[t.origem]}
            </span>
          </div>

          <div className="flex items-start gap-1 mt-1.5">
            <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600">{t.endereco}</p>
          </div>

          {(t.telefone || tutor?.telefone) && (
            <a href={`tel:${t.telefone || tutor?.telefone}`}
              className="flex items-center gap-1 mt-1 text-xs text-brand-teal font-semibold w-fit">
              <Phone size={11} /> {t.telefone || tutor?.telefone}
            </a>
          )}

          {t.status === 'concluido' && t.concluido_em && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {t.tipo === 'buscar' ? 'Recebido' : 'Entregue'} às {formatTime(t.concluido_em)}
            </p>
          )}
          {t.status === 'imprevisto' && t.motivo_imprevisto && (
            <p className="text-xs text-yellow-600 mt-1">⚠ {t.motivo_imprevisto}</p>
          )}
        </div>

        {editavel && (
          <button onClick={() => onRemover(t)} className="p-1.5 text-gray-300 hover:text-red-400">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Troca de meio em 1 toque */}
        <button
          onClick={() => onToggleMeio(t)}
          disabled={!editavel}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors disabled:opacity-60 ${
            t.meio === 'playdog'
              ? 'border-orange-200 bg-orange-50 text-brand-orange'
              : 'border-purple-200 bg-purple-50 text-brand-purple'
          }`}
        >
          {t.meio === 'playdog'
            ? '🚐 Nosso transporte'
            : tab === 'coleta' ? '👤 Tutor traz' : '👤 Tutor busca'}
          {editavel && <span className="text-gray-400 font-normal ml-1">· trocar</span>}
        </button>

        {/* Check da recepção para quem vem/vai pelo tutor */}
        {t.meio === 'tutor' && podeEditar && t.status === 'pendente' && (
          <button onClick={() => onCheck(t)}
            className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-bold flex items-center justify-center gap-1">
            <Check size={14} /> {tab === 'coleta' ? 'Recebido' : 'Entregue ao tutor'}
          </button>
        )}
        {t.meio === 'tutor' && podeEditar && t.status === 'concluido' && (
          <button onClick={() => onCheck(t, true)}
            className="py-2 px-3 rounded-xl border border-gray-200 text-gray-400 text-xs font-semibold">
            desfazer
          </button>
        )}
      </div>
    </div>
  )
}
