'use client'

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Share2, Dog, X, Loader2, MessageCircle, Mail, Instagram, ChevronRight } from 'lucide-react'
import { formatDate, calcIdade, PORTE_LABELS, vacinaStatus } from '@/lib/utils'
import { hojeLocal } from '@/lib/datas'
import { gerarRelatorioPDF, type RelatorioPDF } from '@/lib/pdfRelatorio'
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
  const [, setEnviando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [sheetAberto, setSheetAberto] = useState(false)

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

  // Pré-seleciona um cão quando a tela é aberta com ?pet=<id>
  useEffect(() => {
    if (pets.length === 0) return
    const petId = new URLSearchParams(window.location.search).get('pet')
    if (!petId) return
    const pet = pets.find(p => p.id === petId)
    if (pet) { setFiltroTutor(pet.tutor?.id ?? ''); setFiltroCao(pet.id) }
    // aplica só na primeira carga dos pets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets.length])

  function abrirRelatorioDoPet(pet: PetComTutor) {
    setFiltroTutor(pet.tutor?.id ?? '')
    setFiltroCao(pet.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  function montarDados(): RelatorioPDF {
    return {
      periodoLabel,
      totalPresencas,
      totalCaes: relatorio.length,
      totalTutores: tutoresUnicos.length,
      pets: relatorio.map(r => ({
        nome: r.pet.nome,
        detalhe: [r.pet.identificador, r.pet.raca, PORTE_LABELS[r.pet.porte], r.pet.data_nascimento ? calcIdade(r.pet.data_nascimento) : null].filter(Boolean).join(' · '),
        tutor: [r.pet.tutor?.nome, r.pet.tutor?.telefone].filter(Boolean).join(' · '),
        fotoUrl: r.pet.foto_url,
        presencas: r.presencas.map(p => formatDate(p.data, 'dd/MM (EEE)')),
        ocorrencias: r.ocorrencias.map(o => ({ data: formatDate(o.created_at, 'dd/MM'), descricao: o.descricao })),
        vacinas: r.vacinas.map(v => ({ label: v.label, vencimento: formatDate(v.vencimento, 'dd/MM/yyyy'), vencida: v.vencida })),
      })),
    }
  }

  function nomeArquivo(): string {
    const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    const petSel = filtroCao ? pets.find(p => p.id === filtroCao) : null
    const base = petSel ? `relatorio-${slug(petSel.nome)}` : 'relatorio-presencas'
    return `${base}.pdf`
  }

  async function salvar() {
    if (relatorio.length === 0) return
    setGerando(true)
    try {
      const doc = await gerarRelatorioPDF(montarDados())
      doc.save(nomeArquivo())
    } catch { alert('Não foi possível gerar o PDF. Tente novamente.') }
    setGerando(false)
    setSheetAberto(false)
  }

  async function compartilhar() {
    if (relatorio.length === 0) return
    setGerando(true)
    try {
      const doc = await gerarRelatorioPDF(montarDados())
      const blob = doc.output('blob')
      const file = new File([blob], nomeArquivo(), { type: 'application/pdf' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> }
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'Relatório de presenças — Play Dog' })
      } else {
        doc.save(nomeArquivo())
        alert('Seu dispositivo não permite compartilhar direto. O PDF foi salvo para você anexar manualmente.')
      }
    } catch {
      // usuário pode cancelar o compartilhamento — ignora
    }
    setGerando(false)
    setSheetAberto(false)
  }

  return (
    <>
      <div className="py-6 flex flex-col gap-4">
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
              <button
                key={r.pet.id}
                onClick={() => abrirRelatorioDoPet(r.pet)}
                className="w-full text-left bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm hover:border-brand-purple/40 active:scale-[0.99] transition"
              >
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
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
            {(filtroCao || filtroTutor) && (
              <button
                onClick={() => { setFiltroCao(''); setFiltroTutor('') }}
                className="text-xs text-brand-purple font-semibold py-1"
              >
                ← Ver todos os cães
              </button>
            )}
          </div>
        )}

        {/* Ação principal */}
        <button
          onClick={() => setSheetAberto(true)}
          disabled={relatorio.length === 0 || gerando}
          className="flex items-center justify-center gap-2 bg-brand-purple text-white rounded-2xl py-3.5 font-semibold disabled:opacity-40 shadow-sm"
        >
          {gerando ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
          {gerando ? 'Gerando PDF...' : 'Salvar ou compartilhar PDF'}
        </button>
      </div>

      {/* ===================== Folha de compartilhamento ===================== */}
      {sheetAberto && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => !gerando && setSheetAberto(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-5 pb-8 shadow-2xl animate-[slideUp_.2s_ease]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Compartilhar relatório</h2>
              <button onClick={() => setSheetAberto(false)} className="p-1 text-gray-400"><X size={22} /></button>
            </div>

            {gerando ? (
              <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
                <Loader2 size={28} className="animate-spin text-brand-purple" />
                <p className="text-sm">Gerando o PDF...</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <ShareOpt icon={<Download size={24} />} label="Salvar" cor="bg-purple-100 text-brand-purple" onClick={salvar} />
                <ShareOpt icon={<MessageCircle size={24} />} label="WhatsApp" cor="bg-green-100 text-green-600" onClick={compartilhar} />
                <ShareOpt icon={<Instagram size={24} />} label="Instagram" cor="bg-pink-100 text-pink-600" onClick={compartilhar} />
                <ShareOpt
                  icon={<Mail size={24} />} label="E-mail" cor="bg-blue-100 text-blue-600"
                  onClick={() => { if (filtroTutor) { setSheetAberto(false); enviarEmail() } else { compartilhar() } }}
                />
              </div>
            )}

            {!gerando && (
              <p className="text-[11px] text-gray-400 text-center mt-4">
                {filtroTutor
                  ? 'O e-mail é enviado direto ao tutor selecionado. WhatsApp e Instagram abrem o compartilhamento do seu aparelho.'
                  : 'WhatsApp, Instagram e E-mail abrem o compartilhamento do seu aparelho. Selecione um tutor para enviar o e-mail automático.'}
              </p>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

    </>
  )
}

function ShareOpt({ icon, label, cor, onClick }: { icon: ReactNode; label: string; cor: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cor}`}>{icon}</span>
      <span className="text-[11px] text-gray-600 font-medium">{label}</span>
    </button>
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
