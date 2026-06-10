'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, MapPin, Phone, Check, Fuel, Navigation, AlertTriangle,
  ChevronUp, ChevronDown, Play, Flag,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'
import {
  STATUS_ROTA_LABELS, STATUS_ROTA_CORES, MOTIVOS_IMPREVISTO,
  googleMapsUrl, wazeUrl, formatKm, formatDuracao,
} from '@/lib/transporte'
import type { Transporte, Rota } from '@/types/transporte'
import { useProfile } from '@/hooks/useProfile'

export default function RotaPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [rota, setRota] = useState<Rota | null>(null)
  const [paradas, setParadas] = useState<Transporte[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  // Modal de km (iniciar / finalizar)
  const [modalKm, setModalKm] = useState<'iniciar' | 'finalizar' | null>(null)
  const [km, setKm] = useState('')
  const [kmInicialPendente, setKmInicialPendente] = useState('') // lembrete: finalizar sem km inicial
  const [salvandoKm, setSalvandoKm] = useState(false)
  const [erroKm, setErroKm] = useState('')

  // Modal de imprevisto
  const [modalImprev, setModalImprev] = useState<Transporte | null>(null)
  const [motivo, setMotivo] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')

  const podeReordenar = profile?.role === 'admin' || profile?.role === 'recepcao'
  const isColeta = rota?.tipo === 'coleta'

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: r }, { data: ts }] = await Promise.all([
      supabase.from('rotas').select('*').eq('id', id).single(),
      supabase
        .from('transportes')
        .select('*, pet:pets_rota(id, nome, identificador, foto_url, tutor_id, tutor:tutores_rota(nome, telefone, whatsapp, endereco))')
        .eq('rota_id', id)
        .order('ordem', { ascending: true, nullsFirst: false }),
    ])
    setRota(r as Rota)
    setParadas((ts as Transporte[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const concluidas = paradas.filter(p => p.status === 'concluido')
  const imprevistos = paradas.filter(p => p.status === 'imprevisto')
  const proximaParada = paradas.find(p => p.status === 'pendente' || p.status === 'em_rota')

  function abrirModalKm(tipo: 'iniciar' | 'finalizar') {
    setKm('')
    setKmInicialPendente('')
    setErroKm('')
    setModalKm(tipo)
  }

  async function confirmarKm() {
    setErroKm('')
    const valor = parseFloat(km.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErroKm('Informe o km do painel.'); return }

    // Lembrete automático: finalizar sem km inicial pede os dois
    const faltaInicial = modalKm === 'finalizar' && rota?.km_inicial == null
    let kmInicial: number | null = null
    if (faltaInicial) {
      kmInicial = parseFloat(kmInicialPendente.replace(',', '.'))
      if (isNaN(kmInicial) || kmInicial <= 0) { setErroKm('Informe também o km de saída.'); return }
      if (valor < kmInicial) { setErroKm('O km final deve ser maior que o km de saída.'); return }
    }
    if (modalKm === 'finalizar' && rota?.km_inicial != null && valor < rota.km_inicial) {
      setErroKm(`O km final deve ser maior que o km de saída (${rota.km_inicial}).`)
      return
    }

    setSalvandoKm(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (modalKm === 'iniciar') {
      await supabase.from('rotas').update({
        km_inicial: valor,
        status: 'em_andamento',
        iniciada_em: new Date().toISOString(),
        motorista_id: user?.id,
      }).eq('id', id)
      // Paradas pendentes entram "em rota"
      await supabase.from('transportes').update({ status: 'em_rota' })
        .eq('rota_id', id).eq('status', 'pendente')
    } else {
      await supabase.from('rotas').update({
        km_final: valor,
        ...(kmInicial != null ? { km_inicial: kmInicial } : {}),
        status: 'finalizada',
        finalizada_em: new Date().toISOString(),
      }).eq('id', id)
    }

    setSalvandoKm(false)
    setModalKm(null)
    await carregar()
  }

  // 1 toque: embarcou (coleta) / entregue (entrega) — horário automático
  async function marcar(p: Transporte) {
    setMarcando(p.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('transportes').update({
      status: 'concluido',
      concluido_em: new Date().toISOString(),
      concluido_por: user?.id,
    }).eq('id', p.id)
    await carregar()
    setMarcando(null)
  }

  async function desfazer(p: Transporte) {
    const supabase = createClient()
    await supabase.from('transportes').update({
      status: rota?.status === 'em_andamento' ? 'em_rota' : 'pendente',
      concluido_em: null,
      concluido_por: null,
      motivo_imprevisto: null,
    }).eq('id', p.id)
    await carregar()
  }

  async function confirmarImprevisto() {
    if (!modalImprev) return
    const motivoFinal = motivo === 'Outro' ? motivoOutro.trim() : motivo
    if (!motivoFinal) return
    const supabase = createClient()
    await supabase.from('transportes').update({
      status: 'imprevisto',
      motivo_imprevisto: motivoFinal,
    }).eq('id', modalImprev.id)
    setModalImprev(null)
    setMotivo('')
    setMotivoOutro('')
    await carregar()
  }

  async function mover(p: Transporte, dir: -1 | 1) {
    const idx = paradas.findIndex(x => x.id === p.id)
    const alvo = paradas[idx + dir]
    if (!alvo) return
    const supabase = createClient()
    await Promise.all([
      supabase.from('transportes').update({ ordem: alvo.ordem ?? idx + dir + 1 }).eq('id', p.id),
      supabase.from('transportes').update({ ordem: p.ordem ?? idx + 1 }).eq('id', alvo.id),
    ])
    await carregar()
  }

  if (loading || !rota) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-6 flex flex-col gap-4 pb-40">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transportes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isColeta ? '🌅 Rota de Coleta' : '🌇 Rota de Entrega'}
          </h1>
          <p className="text-xs text-gray-400 capitalize">{formatDate(rota.data + 'T12:00:00', "EEEE, dd 'de' MMMM")}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${STATUS_ROTA_CORES[rota.status]}`}>
          {STATUS_ROTA_LABELS[rota.status]}
        </span>
      </div>

      {/* Contador no topo */}
      <div className={`rounded-2xl p-4 text-white ${isColeta ? 'bg-blue-500' : 'bg-brand-purple'}`}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{concluidas.length} / {paradas.length}</p>
            <p className="text-sm opacity-80">{isColeta ? 'a bordo' : 'entregues'}</p>
          </div>
          <div className="text-right text-xs opacity-80">
            {rota.distancia_total_km != null && <p>{formatKm(rota.distancia_total_km)} estimados</p>}
            {rota.duracao_estimada_min != null && <p>{formatDuracao(rota.duracao_estimada_min)} estimados</p>}
            {imprevistos.length > 0 && <p className="text-yellow-200">⚠ {imprevistos.length} imprevisto{imprevistos.length > 1 ? 's' : ''}</p>}
          </div>
        </div>
      </div>

      {/* Iniciar rota */}
      {rota.status === 'planejada' && (
        <button onClick={() => abrirModalKm('iniciar')}
          className="py-4 rounded-2xl bg-green-500 text-white font-bold flex items-center justify-center gap-2 text-lg">
          <Play size={22} /> Iniciar rota
        </button>
      )}

      {/* Paradas */}
      <div className="flex flex-col gap-3">
        {paradas.map((p, i) => {
          const pet = p.pet
          const atual = proximaParada?.id === p.id && rota.status === 'em_andamento'
          const feita = p.status === 'concluido'
          const imprev = p.status === 'imprevisto'

          return (
            <div key={p.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                atual ? 'border-brand-orange ring-2 ring-brand-orange/30' : 'border-gray-100'
              } ${feita || imprev ? 'opacity-70' : ''}`}>
              <div className="p-4 flex items-start gap-3">
                {/* Número da parada */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 ${
                  feita ? 'bg-green-500 text-white' : imprev ? 'bg-yellow-400 text-white' : atual ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {feita ? <Check size={14} /> : imprev ? '!' : i + 1}
                </div>

                {/* Foto */}
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pet?.foto_url
                    ? <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
                    : <span className="text-2xl">🐾</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-lg leading-tight">
                    {pet?.nome ?? 'Pet'}
                    {pet?.identificador && <span className="text-gray-400 font-normal text-sm ml-1">({pet.identificador})</span>}
                  </p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">{p.endereco}</p>
                  </div>
                  {(p.telefone || pet?.tutor?.telefone) && (
                    <a href={`tel:${p.telefone || pet?.tutor?.telefone}`}
                      className="flex items-center gap-1 mt-1 text-xs text-brand-teal font-semibold w-fit">
                      <Phone size={11} /> {p.telefone || pet?.tutor?.telefone}
                    </a>
                  )}
                  {feita && p.concluido_em && (
                    <p className="text-xs text-green-600 font-semibold mt-1">
                      ✓ {isColeta ? 'Embarcou' : 'Entregue'} às {formatTime(p.concluido_em)}
                    </p>
                  )}
                  {imprev && <p className="text-xs text-yellow-600 font-semibold mt-1">⚠ {p.motivo_imprevisto}</p>}
                </div>

                {/* Reordenar (recepção) */}
                {podeReordenar && rota.status !== 'finalizada' && !feita && !imprev && (
                  <div className="flex flex-col">
                    <button onClick={() => mover(p, -1)} disabled={i === 0}
                      className="p-1 text-gray-300 disabled:opacity-30 hover:text-gray-600"><ChevronUp size={18} /></button>
                    <button onClick={() => mover(p, 1)} disabled={i === paradas.length - 1}
                      className="p-1 text-gray-300 disabled:opacity-30 hover:text-gray-600"><ChevronDown size={18} /></button>
                  </div>
                )}
              </div>

              {/* Ações da parada */}
              {!feita && !imprev && rota.status !== 'finalizada' && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  {/* Navegação */}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={googleMapsUrl(p.endereco)} target="_blank" rel="noopener noreferrer"
                      className="py-2.5 rounded-xl bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <Navigation size={14} /> Google Maps
                    </a>
                    <a href={wazeUrl(p.endereco)} target="_blank" rel="noopener noreferrer"
                      className="py-2.5 rounded-xl bg-cyan-50 text-cyan-600 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <Navigation size={14} /> Waze
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => marcar(p)} disabled={marcando === p.id}
                      className="flex-1 py-3.5 rounded-xl bg-green-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                      {marcando === p.id
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><Check size={18} /> {isColeta ? 'Embarcou' : 'Entregue'}</>}
                    </button>
                    <button onClick={() => { setModalImprev(p); setMotivo(''); setMotivoOutro('') }}
                      className="px-4 py-3.5 rounded-xl border-2 border-yellow-300 text-yellow-600">
                      <AlertTriangle size={18} />
                    </button>
                  </div>
                </div>
              )}

              {(feita || imprev) && rota.status === 'em_andamento' && (
                <div className="px-4 pb-3">
                  <button onClick={() => desfazer(p)} className="text-xs text-gray-400 font-semibold">
                    desfazer
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {paradas.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">Nenhuma parada nesta rota.</p>
        )}
      </div>

      {/* Finalizar rota */}
      {rota.status === 'em_andamento' && (
        <button onClick={() => abrirModalKm('finalizar')}
          className="py-4 rounded-2xl bg-brand-purple text-white font-bold flex items-center justify-center gap-2">
          <Flag size={20} /> Finalizar rota
        </button>
      )}

      {rota.status === 'finalizada' && (
        <div className="bg-green-50 rounded-2xl p-4 text-center">
          <p className="font-bold text-green-700">Rota finalizada ✓</p>
          {rota.km_inicial != null && rota.km_final != null && (
            <p className="text-sm text-green-600 mt-1">
              {formatKm(rota.km_final - rota.km_inicial)} rodados ({rota.km_inicial} → {rota.km_final})
            </p>
          )}
        </div>
      )}

      {/* Botão fixo de abastecimento */}
      <Link href="/transportes/abastecimento"
        className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-center shadow-lg flex items-center justify-center gap-2 z-30">
        <Fuel size={18} /> ⛽ Abastecimento
      </Link>

      {/* Modal de km — 1 campo, 1 toque */}
      {modalKm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              {modalKm === 'iniciar' ? 'Km do painel na saída' : 'Km do painel na chegada'}
            </h2>

            {modalKm === 'finalizar' && rota.km_inicial == null && (
              <div>
                <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mb-2">
                  ⚠ O km de saída não foi informado. Preencha os dois:
                </p>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Km na saída</label>
                <input
                  type="text" inputMode="decimal"
                  value={kmInicialPendente}
                  onChange={e => setKmInicialPendente(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-3xl font-bold text-center"
                />
              </div>
            )}

            <input
              autoFocus
              type="text" inputMode="decimal"
              value={km}
              onChange={e => setKm(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-5 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-4xl font-bold text-center"
            />

            {erroKm && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erroKm}</p>}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModalKm(null)}
                className="py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold">
                Agora não
              </button>
              <button onClick={confirmarKm} disabled={salvandoKm}
                className="py-4 rounded-2xl bg-green-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {salvandoKm
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Check size={18} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de imprevisto */}
      {modalImprev && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Imprevisto — {modalImprev.pet?.nome}</h2>
            <p className="text-sm text-gray-500">Registra o motivo e pula para a próxima parada.</p>

            <div className="flex flex-col gap-2">
              {MOTIVOS_IMPREVISTO.map(m => (
                <button key={m} onClick={() => setMotivo(m)}
                  className={`py-3 rounded-xl text-sm font-semibold border-2 ${
                    motivo === m ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'
                  }`}>
                  {m}
                </button>
              ))}
            </div>

            {motivo === 'Outro' && (
              <input
                autoFocus
                value={motivoOutro}
                onChange={e => setMotivoOutro(e.target.value)}
                placeholder="Descreva o motivo..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-yellow-400 outline-none text-sm"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModalImprev(null)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold">
                Voltar
              </button>
              <button onClick={confirmarImprevisto}
                disabled={!motivo || (motivo === 'Outro' && !motivoOutro.trim())}
                className="py-3 rounded-2xl bg-yellow-500 text-white font-bold disabled:opacity-50">
                Registrar e pular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
