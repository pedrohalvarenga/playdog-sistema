'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Send, Dog } from 'lucide-react'
import Link from 'next/link'
import { formatDate, calcIdade, PORTE_LABELS, vacinaStatus } from '@/lib/utils'
import { hojeLocal } from '@/lib/datas'
import type { Pet, Presenca, Ocorrencia } from '@/types'

type PetComTutor = Pet & { tutor: { id: string; nome: string; telefone: string; email?: string } }

type Preset = 'este_mes' | 'mes_passado' | 'ultimos_30' | 'ultimo_pacote' | 'livre'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: 'ultimos_30', label: 'Últimos 30 dias' },
  { id: 'ultimo_pacote', label: 'Último pacote' },
  { id: 'livre', label: 'Livre' },
]

const VACINAS = [
  { campo: 'vacina_v8_v10', label: 'V8/V10' },
  { campo: 'vacina_antirabica', label: 'Antirrábica' },
  { campo: 'vacina_gripe', label: 'Gripe' },
  { campo: 'vacina_giardia', label: 'Giardia' },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Soma dias a uma data YYYY-MM-DD (cálculo em UTC para não escorregar fuso). */
function addDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Data de vencimento (última dose + 1 ano) se a vacina vence nos próximos 30 dias ou já venceu. */
function vacinaAVencer(dataDose: string | null | undefined): string | null {
  const status = vacinaStatus(dataDose)
  if (status !== 'atencao' && status !== 'vencida') return null
  return addDias(dataDose as string, 365)
}

interface PetRelatorio {
  pet: PetComTutor
  presencas: Presenca[]
  ocorrencias: Ocorrencia[]
  vacinas: { label: string; vencimento: string; vencida: boolean }[]
}

export default function RelatorioCrechePage() {
  const router = useRouter()
  const hoje = useMemo(() => hojeLocal(), [])

  const [preset, setPreset] = useState<Preset>('este_mes')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [filtroCao, setFiltroCao] = useState('')
  const [filtroTutor, setFiltroTutor] = useState('')

  const [pets, setPets] = useState<PetComTutor[]>([])
  const [relatorio, setRelatorio] = useState<PetRelatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // Define o período a partir do preset escolhido
  useEffect(() => {
    if (preset === 'livre') return
    const [hy, hm] = hoje.split('-').map(Number)
    if (preset === 'este_mes') {
      const ultimo = new Date(hy, hm, 0).getDate()
      setInicio(`${hy}-${pad(hm)}-01`)
      setFim(`${hy}-${pad(hm)}-${pad(ultimo)}`)
    } else if (preset === 'mes_passado') {
      const my = hm === 1 ? hy - 1 : hy
      const mm = hm === 1 ? 12 : hm - 1
      const ultimo = new Date(my, mm, 0).getDate()
      setInicio(`${my}-${pad(mm)}-01`)
      setFim(`${my}-${pad(mm)}-${pad(ultimo)}`)
    } else if (preset === 'ultimos_30') {
      setInicio(addDias(hoje, -29))
      setFim(hoje)
    }
    // 'ultimo_pacote' é resolvido no carregar(), pois depende do banco
  }, [preset, hoje])

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Pets que frequentam a creche
    const { data: petsData } = await supabase
      .from('pets')
      .select('*, tutor:tutores(id, nome, telefone, email)')
      .eq('ativo', true)
      .contains('areas_servico', ['creche'])
      .order('nome')

    const todosPets = (petsData as PetComTutor[]) ?? []
    setPets(todosPets)

    // Escopo de pets conforme filtros de cão/tutor
    let escopo = todosPets
    if (filtroTutor) escopo = escopo.filter(p => p.tutor?.id === filtroTutor)
    if (filtroCao) escopo = escopo.filter(p => p.id === filtroCao)
    const petIds = escopo.map(p => p.id)

    if (petIds.length === 0) { setRelatorio([]); setLoading(false); return }

    // Resolve período do "último pacote" (última compra de diárias no escopo)
    let ini = inicio
    let fimP = fim
    if (preset === 'ultimo_pacote') {
      const { data: ultimaCompra } = await supabase
        .from('compras_diarias')
        .select('data')
        .in('pet_id', petIds)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle()
      ini = ultimaCompra?.data ?? `${hoje.slice(0, 7)}-01`
      fimP = hoje
      setInicio(ini)
      setFim(fimP)
    }

    if (!ini || !fimP) { setLoading(false); return }

    const [{ data: presencas }, { data: ocorrencias }] = await Promise.all([
      supabase.from('presencas').select('*').in('pet_id', petIds).gte('data', ini).lte('data', fimP).order('data'),
      supabase.from('ocorrencias').select('*').in('pet_id', petIds).gte('created_at', `${ini}T00:00:00`).lte('created_at', `${fimP}T23:59:59`).order('created_at'),
    ])

    const resultado: PetRelatorio[] = escopo.map(pet => {
      const p = pet as Pet & Record<string, string | null>
      const vacs = VACINAS
        .map(v => {
          const venc = vacinaAVencer(p[v.campo])
          if (!venc) return null
          return { label: v.label, vencimento: venc, vencida: vacinaStatus(p[v.campo]) === 'vencida' }
        })
        .filter(Boolean) as PetRelatorio['vacinas']
      return {
        pet,
        presencas: (presencas ?? []).filter(x => x.pet_id === pet.id),
        ocorrencias: (ocorrencias ?? []).filter(x => x.pet_id === pet.id),
        vacinas: vacs,
      }
    }).filter(r => r.presencas.length > 0 || r.ocorrencias.length > 0 || r.vacinas.length > 0)

    setRelatorio(resultado)
    setLoading(false)
  }, [filtroTutor, filtroCao, inicio, fim, preset, hoje])

  useEffect(() => { carregar() }, [carregar])

  const tutoresUnicos = useMemo(() => {
    const map = new Map<string, string>()
    pets.forEach(p => { if (p.tutor) map.set(p.tutor.id, p.tutor.nome) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [pets])

  const caesFiltrados = useMemo(
    () => (filtroTutor ? pets.filter(p => p.tutor?.id === filtroTutor) : pets),
    [pets, filtroTutor],
  )

  const totalPresencas = relatorio.reduce((s, r) => s + r.presencas.length, 0)
  const tutorSelecionado = filtroTutor ? pets.find(p => p.tutor?.id === filtroTutor)?.tutor : null

  async function enviarEmail() {
    if (!tutorSelecionado) { alert('Selecione um tutor para enviar o relatório por e-mail.'); return }
    if (!tutorSelecionado.email) { alert('Este tutor não tem e-mail cadastrado. Cadastre em Editar Tutor.'); return }
    setEnviando(true)
    const res = await fetch('/api/email/enviar-relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_id: filtroTutor, inicio, fim, pet_id: filtroCao || null }),
    })
    if (res.ok) alert('Relatório enviado com sucesso!')
    else { const err = await res.json().catch(() => ({})); alert(err.error ?? 'Erro ao enviar e-mail') }
    setEnviando(false)
  }

  const periodoLabel = inicio && fim
    ? `${formatDate(inicio, 'dd/MM/yyyy')} a ${formatDate(fim, 'dd/MM/yyyy')}`
    : ''

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ===================== TELA (não imprime) ===================== */}
      <div className="no-print py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/creche')} className="p-2 rounded-xl text-gray-400">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Relatório de presenças</h1>
              <p className="text-xs text-gray-400">Extrato por período</p>
            </div>
          </div>
        </div>

        {/* Atalhos de período */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Período</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                  preset === p.id ? 'bg-brand-purple text-white' : 'bg-purple-50 text-brand-purple'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datas */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-gray-400">De</label>
            <input
              type="date" value={inicio}
              onChange={e => { setInicio(e.target.value); setPreset('livre') }}
              className="w-full px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-gray-400">Até</label>
            <input
              type="date" value={fim}
              onChange={e => { setFim(e.target.value); setPreset('livre') }}
              className="w-full px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
            />
          </div>
        </div>

        {/* Filtros cão / tutor */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-gray-400">Tutor</label>
            <select
              value={filtroTutor}
              onChange={e => { setFiltroTutor(e.target.value); setFiltroCao('') }}
              className="w-full px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
            >
              <option value="">Todos</option>
              {tutoresUnicos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-gray-400">Cão</label>
            <select
              value={filtroCao}
              onChange={e => setFiltroCao(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
            >
              <option value="">Todos</option>
              {caesFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Resumo */}
        <div className="flex gap-3">
          <div className="flex-1 bg-brand-purple rounded-2xl p-3 text-center text-white">
            <p className="text-2xl font-bold">{totalPresencas}</p>
            <p className="text-xs opacity-80">Presenças</p>
          </div>
          <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{relatorio.length}</p>
            <p className="text-xs text-gray-500">Cães</p>
          </div>
          <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{tutoresUnicos.length}</p>
            <p className="text-xs text-gray-500">Tutores</p>
          </div>
        </div>

        {/* Lista (preview) */}
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : relatorio.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Dog size={40} className="mx-auto mb-2 opacity-30" />
            <p>Sem movimentações no período</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {relatorio.map(r => (
              <div key={r.pet.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <PetAvatar pet={r.pet} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {r.pet.nome}
                    {r.pet.identificador && <span className="text-xs text-gray-400 font-normal"> · {r.pet.identificador}</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">Tutor: {r.pet.tutor?.nome}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-brand-purple">{r.presencas.length}</p>
                  <p className="text-[10px] text-gray-400">presenças</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => window.print()}
            disabled={relatorio.length === 0}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 rounded-2xl py-3 font-semibold disabled:opacity-40"
          >
            <Printer size={18} /> Gerar PDF
          </button>
          <button
            onClick={enviarEmail}
            disabled={enviando || !filtroTutor}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-purple text-white rounded-2xl py-3 font-semibold disabled:opacity-40"
          >
            <Send size={18} /> {enviando ? 'Enviando...' : 'Enviar e-mail'}
          </button>
        </div>
        {!filtroTutor && (
          <p className="text-[11px] text-gray-400 text-center -mt-2">
            Selecione um tutor para habilitar o envio por e-mail.
          </p>
        )}
      </div>

      {/* ===================== PDF (somente impressão) ===================== */}
      <div className="print-only" style={{ fontFamily: 'system-ui, sans-serif', color: '#2C2C2A' }}>
        <div style={{ display: 'flex', height: 6 }}>
          <div style={{ flex: 1, background: '#8A05BE' }} />
          <div style={{ flex: 1, background: '#FF5600' }} />
          <div style={{ flex: 1, background: '#00E9D2' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px 12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-playdog.png" alt="Play Dog" style={{ height: 54, width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Relatório de presenças</div>
            <div style={{ fontSize: 12, color: '#8A05BE' }}>{periodoLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid #F1EFE8', borderBottom: '1px solid #F1EFE8', padding: '10px 0', marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#8A05BE' }}>{totalPresencas}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>Presenças no período</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #F1EFE8', borderRight: '1px solid #F1EFE8' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00B9A6' }}>{relatorio.length}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>Cães</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#FF5600' }}>{tutoresUnicos.length}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>Tutores</div>
          </div>
        </div>

        {relatorio.map(r => (
          <div key={r.pet.id} style={{ marginBottom: 22, breakInside: 'avoid' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.pet.foto_url
                ? <img src={r.pet.foto_url} alt={r.pet.nome} style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover', border: '2px solid #EEEDFE' }} />
                : <div style={{ width: 58, height: 58, borderRadius: 14, background: '#F4F0FB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A05BE', fontWeight: 700 }}>{r.pet.nome.charAt(0)}</div>}
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#8A05BE' }}>{r.pet.nome}</div>
                <div style={{ fontSize: 12, color: '#888780' }}>
                  {[r.pet.identificador, r.pet.raca, PORTE_LABELS[r.pet.porte], r.pet.data_nascimento ? calcIdade(r.pet.data_nascimento) : null].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12, color: '#888780' }}>
                  Tutor: {r.pet.tutor?.nome}{r.pet.tutor?.telefone ? ` · ${r.pet.tutor.telefone}` : ''}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', color: '#8A05BE', textTransform: 'uppercase', marginBottom: 8 }}>
              Presenças no período ({r.presencas.length})
            </div>
            {r.presencas.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {r.presencas.map(p => (
                  <span key={p.id} style={{ background: '#F4F0FB', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#3C3489', fontWeight: 500 }}>
                    {formatDate(p.data, 'dd/MM (EEE)')}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#888780', marginBottom: 14 }}>Sem presenças no período.</div>
            )}

            {r.ocorrencias.length > 0 && (
              <div style={{ padding: '10px 2px', borderTop: '1px solid #F1EFE8' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#FF5600', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Observações no período
                </div>
                {r.ocorrencias.map(o => (
                  <div key={o.id} style={{ fontSize: 12, color: '#444441', lineHeight: 1.5, marginBottom: 3 }}>
                    {formatDate(o.created_at, 'dd/MM')} — {o.descricao}
                  </div>
                ))}
              </div>
            )}

            {r.vacinas.length > 0 && (
              <div style={{ padding: '10px 2px', borderTop: '1px solid #F1EFE8' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#FF5600', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Vacina(s) a vencer (próximos 30 dias)
                </div>
                {r.vacinas.map(v => (
                  <div key={v.label} style={{ fontSize: 12, color: '#444441', lineHeight: 1.5 }}>
                    {v.label} {v.vencida ? 'venceu em' : 'vence em'} {formatDate(v.vencimento, 'dd/MM/yyyy')} — recomendamos agendar o reforço.
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 18, padding: '12px 0', borderTop: '1px solid #F1EFE8', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#5F5E5A' }}>
            WhatsApp (32) 99165-1894 · @playdogjf · playdogjf.com.br
          </div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>
            Av. Presidente Costa e Silva, 2354 — São Pedro · Juiz de Fora / MG
          </div>
        </div>
      </div>
    </>
  )
}

function PetAvatar({ pet }: { pet: PetComTutor }) {
  if (pet.foto_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pet.foto_url} alt={pet.nome} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
      <span className="text-brand-purple font-bold text-sm">{pet.nome.charAt(0)}</span>
    </div>
  )
}
