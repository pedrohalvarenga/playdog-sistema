'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import DateInput from '@/components/ui/DateInput'
import FotoComCrop from '@/components/ui/FotoComCrop'
import { ArrowLeft, Camera, X, Dog, Loader2 } from 'lucide-react'
import Link from 'next/link'
import VacinaInput from '@/components/pets/VacinaInput'
import type { Tutor, Porte, PlanoTipo, AreaServicoPet } from '@/types'

export default function EditarPetPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [loadingDados, setLoadingDados] = useState(true)
  const [tutores, setTutores] = useState<Tutor[]>([])
  const vacinaRef = useRef<HTMLInputElement>(null)
  const [analisandoVacinas, setAnalisandoVacinas] = useState(false)
  const [msgVacina, setMsgVacina] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoAtual, setFotoAtual] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  const [tutorId, setTutorId] = useState('')
  const [nomePet, setNomePet] = useState('')
  const [raca, setRaca] = useState('')
  const [porte, setPorte] = useState<Porte>('M')
  const [nascimento, setNascimento] = useState('')
  const [castrado, setCastrado] = useState(false)
  const [identificador, setIdentificador] = useState('')
  const [restricoes, setRestrioes] = useState('')
  const [medicacao, setMedicacao] = useState('')
  const [plano, setPlano] = useState<PlanoTipo>('diaria_avulsa')
  const [vacinaV8, setVacinaV8] = useState('')
  const [vacinaRaiva, setVacinaRaiva] = useState('')
  const [vacinaGripe, setVacinaGripe] = useState('')
  const [vacinaGiardia, setVacinaGiardia] = useState('')
  const [areasServico, setAreasServico] = useState<AreaServicoPet[]>([])

  function toggleArea(a: AreaServicoPet) {
    setAreasServico(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: pet }, { data: ts }] = await Promise.all([
        supabase.from('pets').select('*').eq('id', id).single(),
        supabase.from('tutores').select('*').order('nome').limit(200),
      ])
      if (pet) {
        setTutorId(pet.tutor_id ?? '')
        setNomePet(pet.nome ?? '')
        setRaca(pet.raca ?? '')
        setPorte(pet.porte ?? 'M')
        setNascimento(pet.data_nascimento ?? '')
        setCastrado(pet.castrado ?? false)
        setIdentificador((pet as any).identificador ?? '')
        setRestrioes(pet.restricoes ?? '')
        setMedicacao(pet.medicacao ?? '')
        setPlano(pet.plano ?? 'diaria_avulsa')
        setVacinaV8(pet.vacina_v8_v10 ?? '')
        setVacinaRaiva(pet.vacina_antirabica ?? '')
        setVacinaGripe(pet.vacina_gripe ?? '')
        setVacinaGiardia((pet as any).vacina_giardia ?? '')
        setAreasServico((pet as any).areas_servico ?? [])
        setFotoAtual(pet.foto_url ?? null)
      }
      setTutores(ts ?? [])
      setLoadingDados(false)
    }
    load()
  }, [id])

  async function analisarCartaoVacinas(file: File) {
    setAnalisandoVacinas(true)
    setMsgVacina('Analisando com IA...')
    const fd = new FormData()
    fd.append('arquivo', file)
    try {
      const res = await fetch('/api/analisar-vacinas', { method: 'POST', body: fd })
      const dados = await res.json()
      if (dados.vacina_v8_v10) setVacinaV8(dados.vacina_v8_v10)
      if (dados.vacina_antirabica) setVacinaRaiva(dados.vacina_antirabica)
      if (dados.vacina_gripe) setVacinaGripe(dados.vacina_gripe)
      if (dados.vacina_giardia) setVacinaGiardia(dados.vacina_giardia)
      setMsgVacina('Campos preenchidos! Confira e ajuste se necessário.')
    } catch {
      setMsgVacina('Não consegui ler o cartão. Preencha manualmente.')
    }
    setAnalisandoVacinas(false)
  }


  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    let fotoUrl = fotoAtual
    if (fotoFile) {
      const fd = new FormData()
      fd.append('arquivo', fotoFile)
      const res = await fetch('/api/upload-foto-pet', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        fotoUrl = url
      } else {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setLoading(false)
        alert(`Erro ao enviar foto: ${err.error}`)
        return
      }
    }

    const { error } = await supabase.from('pets').update({
      tutor_id: tutorId,
      nome: nomePet,
      identificador: identificador || null,
      raca: raca || null,
      porte,
      data_nascimento: nascimento || null,
      castrado,
      restricoes: restricoes || null,
      medicacao: medicacao || null,
      plano,
      vacina_v8_v10: vacinaV8 || null,
      vacina_antirabica: vacinaRaiva || null,
      vacina_gripe: vacinaGripe || null,
      vacina_giardia: vacinaGiardia || null,
      areas_servico: areasServico,
      foto_url: fotoUrl,
    }).eq('id', id)

    if (error) { setLoading(false); alert(`Erro ao salvar: ${error.message}`); return }
    router.push(`/pets/${id}`)
  }

  const porteBtns: Porte[] = ['P', 'M', 'G']
  const planos: { value: PlanoTipo; label: string }[] = [
    { value: 'diaria_avulsa', label: 'Diária Avulsa' },
    { value: 'pacote_semanal', label: 'Pacote Semanal' },
    { value: 'pacote_mensal', label: 'Pacote Mensal' },
    { value: 'hotel', label: 'Hotel' },
  ]

  if (loadingDados) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/pets/${id}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Editar Pet</h1>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-5">
        {/* Foto */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide self-start">Foto do cão</h2>
          <FotoComCrop
            fotoAtual={fotoAtual}
            previewUrl={fotoPreview}
            onFotoProcessada={(file, preview) => { setFotoFile(file); setFotoPreview(preview); setFotoAtual(null) }}
            onRemover={() => { setFotoFile(null); setFotoPreview(null); setFotoAtual(null) }}
          />
        </section>

        {/* Tutor */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Tutor</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Selecionar tutor</label>
            <select
              value={tutorId}
              onChange={e => setTutorId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white"
            >
              <option value="">Escolha o tutor...</option>
              {tutores.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Dados do Pet */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Dados do Pet</h2>

          <Input label="Nome do pet" value={nomePet} onChange={e => setNomePet(e.target.value)} required />
          <Input label="Como identificamos (apelido, raça, família...)" value={identificador} onChange={e => setIdentificador(e.target.value)} placeholder='Ex: "vira-lata caramelo", "irmão do Bob"' />
          <Input label="Raça" value={raca} onChange={e => setRaca(e.target.value)} placeholder="Ex: Golden Retriever" />
          <DateInput label="Data de nascimento" value={nascimento} onChange={setNascimento} />

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Porte</label>
            <div className="flex gap-2">
              {porteBtns.map(p => (
                <button key={p} type="button" onClick={() => setPorte(p)}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${porte === p ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {p === 'P' ? 'Pequeno' : p === 'M' ? 'Médio' : 'Grande'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
            <label className="font-semibold text-gray-700">Castrado</label>
            <button
              type="button"
              onClick={() => setCastrado(!castrado)}
              className={`w-12 h-7 rounded-full transition-all ${castrado ? 'bg-brand-purple' : 'bg-gray-300'} relative`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${castrado ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <Input
            label="Restrições / Comportamento"
            value={restricoes}
            onChange={e => setRestrioes(e.target.value)}
            placeholder="Ex: Agressivo com machos, não come ração X..."
          />
        </section>

        {/* Medicação */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Medicação</h2>
          <p className="text-xs text-gray-400">Preencha se o animal faz uso de algum medicamento</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Medicamento, dose e horário</label>
            <textarea
              value={medicacao}
              onChange={e => setMedicacao(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none"
              placeholder={`Ex:\nFrontal 1cp às 8h e às 20h\nPrednizona 5mg às 12h com comida`}
            />
          </div>
        </section>

        {/* Áreas de serviço */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Áreas de serviço</h2>
          <p className="text-xs text-gray-400">Selecione todas as áreas que este cão utiliza</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'creche',     label: 'Creche' },
              { value: 'hotel',      label: 'Hotel' },
              { value: 'banho_tosa', label: 'Banho e Tosa' },
              { value: 'adaptacao',  label: 'Adaptação' },
            ] as { value: AreaServicoPet; label: string }[]).map(a => (
              <button
                key={a.value}
                type="button"
                onClick={() => toggleArea(a.value)}
                className={`py-3 px-2 rounded-2xl text-sm font-semibold border-2 transition-all ${
                  areasServico.includes(a.value)
                    ? 'border-brand-purple bg-purple-50 text-brand-purple'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {areasServico.includes(a.value) ? '✓ ' : ''}{a.label}
              </button>
            ))}
          </div>
          {areasServico.includes('adaptacao') && (
            <p className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              Adaptação: cliente em prospecção — visitou mas ainda não contratou.
            </p>
          )}
        </section>

        {/* Plano contratado */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Plano contratado</h2>
          <div className="grid grid-cols-2 gap-2">
            {planos.map(p => (
              <button key={p.value} type="button" onClick={() => setPlano(p.value)}
                className={`py-3 px-2 rounded-2xl text-sm font-semibold transition-all ${plano === p.value ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Vacinas */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Vacinas</h2>
          <input ref={vacinaRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analisarCartaoVacinas(f) }} />
          <button
            type="button"
            onClick={() => vacinaRef.current?.click()}
            disabled={analisandoVacinas}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-purple bg-purple-50 flex items-center justify-center gap-2 text-brand-purple font-semibold text-sm disabled:opacity-50"
          >
            {analisandoVacinas
              ? <><Loader2 size={16} className="animate-spin" /> Analisando cartão...</>
              : <><Camera size={16} /> Fotografar cartão de vacinas (IA)</>}
          </button>
          {msgVacina && (
            <p className={`text-xs text-center font-medium ${msgVacina.includes('Campos') ? 'text-green-600' : 'text-gray-400'}`}>
              {msgVacina}
            </p>
          )}
          <VacinaInput label="V7/V8/V10 ou sorologia — última dose" value={vacinaV8} onChange={setVacinaV8} />
          <VacinaInput label="Antirrábica — última dose" value={vacinaRaiva} onChange={setVacinaRaiva} />
          <VacinaInput label="Gripe — última dose" value={vacinaGripe} onChange={setVacinaGripe} />
          <VacinaInput label="Giardia — última dose" value={vacinaGiardia} onChange={setVacinaGiardia} />
        </section>

        <Button type="submit" size="lg" loading={loading}>
          Salvar Alterações
        </Button>

        <div className="pb-6" />
      </form>
    </div>
  )
}
