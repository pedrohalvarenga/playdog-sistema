'use client'

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Share2, Dog, X, Loader2, MessageCircle, Mail, Instagram, ChevronRight } from 'lucide-react'
import { formatDate, calcIdade, PORTE_LABELS, vacinaStatus } from '@/lib/utils'
import { hojeLocal } from '@/lib/datas'
import { carregarImagemDataUrl, gerarRelatorioPdfVetor, type PetPDF, type RelatorioPDF } from '@/lib/pdfRelatorio'
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

function formatTelefone(t?: string): string {
  const d = (t ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t ?? ''
}

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
  ultimoPacoteData: string | null
  saldoNoDiaPacote: number | null
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
  const [pdfData, setPdfData] = useState<RelatorioPDF | null>(null)

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

    const [{ data: presencas }, { data: ocorrencias }, { data: pacotes }] = await Promise.all([
      supabase.from('presencas').select('*').in('pet_id', petIds).gte('data', ini).lte('data', fimP).order('data'),
      supabase.from('ocorrencias').select('*').in('pet_id', petIds).gte('created_at', `${ini}T00:00:00`).lte('created_at', `${fimP}T23:59:59`).order('created_at'),
      supabase.from('receitas').select('pet_id, data, num_diarias, created_at').in('pet_id', petIds).eq('area', 'creche').eq('status', 'pago').not('num_diarias', 'is', null).order('data', { ascending: false }).order('created_at', { ascending: false }),
    ])

    // Último pacote PAGO por pet (receita mais recente com diárias) — data + horário
    const ultimoPacotePet = new Map<string, { data: string; createdAt: string }>()
    ;(pacotes ?? []).forEach(p => { if (!ultimoPacotePet.has(p.pet_id)) ultimoPacotePet.set(p.pet_id, { data: p.data, createdAt: p.created_at }) })

    // Saldo do pet logo ANTES do último pacote (no momento do pagamento): ancora
    // no saldo_diarias real e desconta os movimentos a partir desse pacote, pelo
    // horário de registro. Mostra se o pet renovou já estando no negativo.
    const tss = [...ultimoPacotePet.values()].map(v => v.createdAt)
    const minTs = tss.length ? tss.reduce((a, b) => (a < b ? a : b)) : null

    let presSince: { pet_id: string; created_at: string }[] = []
    let ajuSince: { pet_id: string; quantidade: number; created_at: string }[] = []
    let freeSince: { pet_id: string; quantidade: number; created_at: string }[] = []
    if (minTs) {
      const [r1, r2, r3] = await Promise.all([
        supabase.from('presencas').select('pet_id, created_at').in('pet_id', petIds).gte('created_at', minTs),
        supabase.from('ajustes_saldo').select('pet_id, quantidade, created_at').in('pet_id', petIds).gte('created_at', minTs),
        supabase.from('compras_diarias').select('pet_id, quantidade, created_at').in('pet_id', petIds).eq('valor_pago', 0).gte('created_at', minTs),
      ])
      presSince = r1.data ?? []
      ajuSince = r2.data ?? []
      freeSince = r3.data ?? []
    }

    const saldoNoDiaPet = new Map<string, number>()
    ultimoPacotePet.forEach((lp, petId) => {
      const live = escopo.find(p => p.id === petId)?.saldo_diarias ?? 0
      const credSince = (pacotes ?? []).filter(p => p.pet_id === petId && (p.created_at ?? '') >= lp.createdAt).reduce((s, p) => s + (p.num_diarias ?? 0), 0)
        + freeSince.filter(c => c.pet_id === petId && c.created_at >= lp.createdAt).reduce((s, c) => s + c.quantidade, 0)
      const presCount = presSince.filter(p => p.pet_id === petId && p.created_at >= lp.createdAt).length
      const ajuSum = ajuSince.filter(a => a.pet_id === petId && a.created_at >= lp.createdAt).reduce((s, a) => s + a.quantidade, 0)
      saldoNoDiaPet.set(petId, live - (credSince - presCount + ajuSum))
    })

    const resultado: PetRelatorio[] = escopo.map(pet => {
      const p = pet as Pet & Record<string, string | null>
      const vacs = VACINAS
        .map(v => {
          const venc = vacinaAVencer(p[v.campo])
          if (!venc) return null
          return { label: v.label, vencimento: venc, vencida: vacinaStatus(p[v.campo]) === 'vencida' }
        })
        .filter(Boolean) as PetRelatorio['vacinas']
      const lp = ultimoPacotePet.get(pet.id)
      return {
        pet,
        presencas: (presencas ?? []).filter(x => x.pet_id === pet.id),
        ocorrencias: (ocorrencias ?? []).filter(x => x.pet_id === pet.id),
        vacinas: vacs,
        ultimoPacoteData: lp?.data ?? null,
        saldoNoDiaPacote: lp ? (saldoNoDiaPet.get(pet.id) ?? 0) : null,
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

  function nomeArquivo(): string {
    const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    const petSel = filtroCao ? pets.find(p => p.id === filtroCao) : null
    const base = petSel ? `relatorio-${slug(petSel.nome)}` : 'relatorio-presencas'
    return `${base}.pdf`
  }

  // Monta os dados do PDF (carrega imagens como dataURL). É feito em segundo
  // plano sempre que o relatório muda, para que a geração no toque seja
  // SÍNCRONA — exigência do iPhone: o navigator.share precisa rodar dentro do
  // gesto do usuário, sem await no meio.
  const montarPdfData = useCallback(async (): Promise<RelatorioPDF> => {
    const logoDataUrl = await carregarImagemDataUrl('/logo-playdog.png')
    const petsPDF: PetPDF[] = await Promise.all(relatorio.map(async r => ({
      nome: r.pet.nome,
      detalhe: [r.pet.identificador, r.pet.raca, PORTE_LABELS[r.pet.porte], r.pet.data_nascimento ? calcIdade(r.pet.data_nascimento) : null].filter(Boolean).join(' · '),
      tutor: [r.pet.tutor?.nome, formatTelefone(r.pet.tutor?.telefone)].filter(Boolean).join(' · '),
      fotoDataUrl: r.pet.foto_url ? await carregarImagemDataUrl(r.pet.foto_url) : null,
      presencas: r.presencas.map(p => formatDate(p.data, 'dd/MM (EEE)')),
      saldo: r.pet.saldo_diarias ?? 0,
      ultimoPacoteData: r.ultimoPacoteData ? formatDate(r.ultimoPacoteData, 'dd/MM/yyyy') : null,
      saldoNoDiaPacote: r.saldoNoDiaPacote,
      ocorrencias: r.ocorrencias.map(o => ({ data: formatDate(o.created_at, 'dd/MM'), descricao: o.descricao })),
      vacinas: r.vacinas.map(v => ({ label: v.label, vencimento: formatDate(v.vencimento, 'dd/MM/yyyy'), vencida: v.vencida })),
    })))
    return { periodoLabel, logoDataUrl, pets: petsPDF }
  }, [relatorio, periodoLabel])

  // Pré-carrega o PDF assim que o relatório fica pronto
  useEffect(() => {
    let cancelado = false
    if (relatorio.length === 0) { setPdfData(null); return }
    setPdfData(null)
    montarPdfData().then(d => { if (!cancelado) setPdfData(d) }).catch(() => {})
    return () => { cancelado = true }
  }, [montarPdfData, relatorio.length])

  async function salvar() {
    if (relatorio.length === 0) return
    setGerando(true)
    try {
      const dados = pdfData ?? await montarPdfData()
      gerarRelatorioPdfVetor(dados).save(nomeArquivo())
    } catch { alert('Não foi possível gerar o PDF. Tente novamente.') }
    setGerando(false)
    setSheetAberto(false)
  }

  async function compartilhar() {
    if (relatorio.length === 0) return
    try {
      // Quando os dados já estão prontos (caso comum), gera SÍNCRONO para o
      // navigator.share rodar dentro do gesto do toque no iPhone.
      let doc
      if (pdfData) {
        doc = gerarRelatorioPdfVetor(pdfData)
      } else {
        setGerando(true)
        doc = gerarRelatorioPdfVetor(await montarPdfData())
        setGerando(false)
      }
      const file = new File([doc.output('blob')], nomeArquivo(), { type: 'application/pdf' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> }
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'Relatório de presenças — Play Dog' })
      } else {
        doc.save(nomeArquivo())
        alert('Seu aparelho não permite compartilhar direto. O PDF foi salvo para você anexar manualmente.')
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
