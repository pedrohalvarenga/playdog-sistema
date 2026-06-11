'use client'

import React, { useState, useRef } from 'react'
import { Dog, Camera, X, CheckCircle, Loader2, Plus } from 'lucide-react'
import type { Porte, PlanoTipo } from '@/types'

const PORTE_LABELS: Record<Porte, string> = { P: 'Pequeno', M: 'Médio', G: 'Grande' }

interface PetCadastro {
  nome: string
  raca: string
  porte: Porte
  data_nascimento: string
  castrado: boolean
  restricoes: string
  medicacao: string
  plano: PlanoTipo
  vacina_v8_v10: string
  vacina_antirabica: string
  vacina_gripe: string
  fotoFile: File | null
  cartaoFile: File | null
}

export default function CadastroPublicoPage() {
  const [etapa, setEtapa] = useState<'tutor' | 'pet' | 'vacinas' | 'sucesso'>('tutor')
  const [loading, setLoading] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const vacinaRef = useRef<HTMLInputElement>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [cartaoFile, setCartaoFile] = useState<File | null>(null)

  // Tutor
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [endereco, setEndereco] = useState('')

  // Pets já concluídos (quando o tutor tem mais de um cão)
  const [petsSalvos, setPetsSalvos] = useState<PetCadastro[]>([])

  // Pet em edição
  const [nomePet, setNomePet] = useState('')
  const [raca, setRaca] = useState('')
  const [porte, setPorte] = useState<Porte>('M')
  const [nascimento, setNascimento] = useState('')
  const [castrado, setCastrado] = useState(false)
  const [restricoes, setRestrioes] = useState('')
  const [medicacao, setMedicacao] = useState('')
  const [plano, setPlano] = useState<PlanoTipo>('diaria_avulsa')

  // Vacinas
  const [vacinaV8, setVacinaV8] = useState('')
  const [vacinaRaiva, setVacinaRaiva] = useState('')
  const [vacinaGripe, setVacinaGripe] = useState('')

  const planos: { value: PlanoTipo; label: string; desc: string }[] = [
    { value: 'diaria_avulsa', label: 'Diária Avulsa', desc: 'Sem mensalidade, paga por dia' },
    { value: 'pacote_semanal', label: 'Pacote Semanal', desc: '5 diárias por semana' },
    { value: 'pacote_mensal', label: 'Pacote Mensal', desc: 'Frequência mensal fixa' },
    { value: 'hotel', label: 'Hotel', desc: 'Hospedagem / pernoite' },
  ]

  function montarPetAtual(): PetCadastro {
    return {
      nome: nomePet, raca, porte, data_nascimento: nascimento,
      castrado, restricoes, medicacao, plano,
      vacina_v8_v10: vacinaV8, vacina_antirabica: vacinaRaiva, vacina_gripe: vacinaGripe,
      fotoFile,
      cartaoFile,
    }
  }

  function limparFormularioPet() {
    setNomePet(''); setRaca(''); setPorte('M'); setNascimento('')
    setCastrado(false); setRestrioes(''); setMedicacao(''); setPlano('diaria_avulsa')
    setVacinaV8(''); setVacinaRaiva(''); setVacinaGripe('')
    setFotoFile(null); setFotoPreview(null); setCartaoFile(null)
  }

  function adicionarOutroCao() {
    setPetsSalvos(prev => [...prev, montarPetAtual()])
    limparFormularioPet()
    setEtapa('pet')
    window.scrollTo({ top: 0 })
  }

  async function uploadFoto(file: File | null): Promise<string | null> {
    if (!file) return null
    const fd = new FormData()
    fd.append('arquivo', file)
    try {
      const r = await fetch('/api/upload-foto-pet', { method: 'POST', body: fd })
      const d = await r.json()
      return d.url ?? null
    } catch {
      return null
    }
  }

  async function enviar() {
    setLoading(true)

    const todosPets = [...petsSalvos, montarPetAtual()]

    // Upload das fotos e cartões de vacina (um por pet, se houver)
    const petsComFoto = []
    for (const p of todosPets) {
      const fotoUrl = await uploadFoto(p.fotoFile)
      const cartaoUrl = await uploadFoto(p.cartaoFile)
      const { fotoFile: _, cartaoFile: __, ...dados } = p
      petsComFoto.push({ ...dados, foto_url: fotoUrl, cartao_vacinas_url: cartaoUrl })
    }

    const res = await fetch('/api/cadastro-publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor: { nome, telefone, cpf, endereco },
        pets: petsComFoto,
      }),
    })

    setLoading(false)
    if (res.ok) {
      setPetsSalvos(todosPets)
      setEtapa('sucesso')
    } else {
      alert('Ocorreu um erro. Tente novamente.')
    }
  }

  if (etapa === 'sucesso') {
    const nomesPets = petsSalvos.map(p => p.nome).filter(Boolean)
    const listaNomes = nomesPets.length > 1
      ? nomesPets.slice(0, -1).join(', ') + ' e ' + nomesPets[nomesPets.length - 1]
      : nomesPets[0] ?? ''
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cadastro realizado!</h1>
          <p className="text-gray-500 mb-1">Olá, <strong>{nome}</strong>!</p>
          <p className="text-gray-500">
            <strong>{listaNomes}</strong> {nomesPets.length > 1 ? 'estão cadastrados' : 'está cadastrado(a)'} na Play Dog. Em breve nossa equipe entrará em contato.
          </p>
          <div className="mt-6 p-4 bg-purple-50 rounded-2xl">
            <p className="text-xs text-purple-600 font-medium">Guarde nosso número</p>
            <p className="text-sm text-gray-700 mt-1">WhatsApp Play Dog</p>
          </div>
        </div>
      </div>
    )
  }

  const numeroCaoAtual = petsSalvos.length + 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50">
      {/* Header */}
      <div className="bg-brand-purple text-white px-4 py-6 text-center">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Dog size={28} />
        </div>
        <h1 className="text-2xl font-bold">Play Dog</h1>
        <p className="text-white/70 text-sm mt-1">Cadastro de tutor e pet</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-4 py-3 bg-white shadow-sm">
        {(['tutor', 'pet', 'vacinas'] as const).map((e, i) => (
          <div key={e} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${etapa === e || (i === 0 && etapa !== 'tutor') || (i === 1 && etapa === 'vacinas') ? 'bg-brand-purple' : 'bg-gray-200'}`} />
            <span className="text-[10px] text-gray-400">{e === 'tutor' ? 'Seus dados' : e === 'pet' ? 'Seu pet' : 'Vacinas'}</span>
          </div>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">

        {/* Pets já adicionados */}
        {petsSalvos.length > 0 && etapa !== 'tutor' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700">
              {petsSalvos.length === 1
                ? <><strong>{petsSalvos[0].nome}</strong> já foi adicionado(a).</>
                : <><strong>{petsSalvos.map(p => p.nome).join(', ')}</strong> já foram adicionados.</>}
            </p>
          </div>
        )}

        {/* ETAPA 1 — TUTOR */}
        {etapa === 'tutor' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900 mt-2">Seus dados</h2>

            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-4">
              <Field label="Nome completo *" value={nome} onChange={setNome} placeholder="Como você se chama" />
              <Field label="WhatsApp *" value={telefone} onChange={setTelefone} type="tel" placeholder="(32) 99999-9999" />
              <Field label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00" />
              <Field label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua, número, bairro..." />
            </section>

            <button
              onClick={() => { if (!nome || !telefone) { alert('Preencha nome e WhatsApp'); return } setEtapa('pet') }}
              className="w-full py-4 bg-brand-purple text-white font-bold rounded-2xl text-base"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ETAPA 2 — PET */}
        {etapa === 'pet' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {numeroCaoAtual > 1 ? `Dados do ${numeroCaoAtual}º cão` : 'Dados do pet'}
            </h2>

            {/* Foto */}
            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center gap-3">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide self-start">Foto do pet (opcional)</h3>
              <input ref={fotoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)) } }} />
              {fotoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoPreview} alt="" className="w-28 h-28 rounded-2xl object-cover" />
                  <button type="button" onClick={() => { setFotoPreview(null); setFotoFile(null) }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fotoRef.current?.click()}
                  className="w-28 h-28 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Camera size={24} />
                  <span className="text-xs">Tirar foto</span>
                </button>
              )}
            </section>

            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-4">
              <Field label="Nome do pet *" value={nomePet} onChange={setNomePet} placeholder="Como o seu pet se chama" />
              <Field label="Raça" value={raca} onChange={setRaca} placeholder="Ex: Labrador, Poodle..." />
              <DateField label="Data de nascimento" value={nascimento} onChange={setNascimento} />

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Porte</label>
                <div className="flex gap-2">
                  {(['P', 'M', 'G'] as Porte[]).map(p => (
                    <button key={p} type="button" onClick={() => setPorte(p)}
                      className={`flex-1 py-3 rounded-2xl font-bold text-sm ${porte === p ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {PORTE_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                <span className="font-semibold text-gray-700">Castrado(a)</span>
                <button type="button" onClick={() => setCastrado(!castrado)}
                  className={`w-12 h-7 rounded-full transition-all ${castrado ? 'bg-brand-purple' : 'bg-gray-300'} relative`}>
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${castrado ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <TextArea label="Restrições / Comportamento" value={restricoes} onChange={setRestrioes}
                placeholder="Ex: Briga com outros machos, tem medo de barulho..." />
              <TextArea label="Medicação" value={medicacao} onChange={setMedicacao}
                placeholder={`Ex:\nFrontal 1cp às 8h\nPrednizona 5mg às 12h com comida`} />
            </section>

            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Tipo de plano</h3>
              <div className="flex flex-col gap-2">
                {planos.map(p => (
                  <button key={p.value} type="button" onClick={() => setPlano(p.value)}
                    className={`py-3 px-4 rounded-2xl text-left transition-all border-2 ${plano === p.value ? 'border-brand-orange bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                    <p className={`font-semibold text-sm ${plano === p.value ? 'text-brand-orange' : 'text-gray-700'}`}>{p.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            <div className="flex gap-3">
              {petsSalvos.length === 0 && (
                <button onClick={() => setEtapa('tutor')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
                  ← Voltar
                </button>
              )}
              <button
                onClick={() => { if (!nomePet) { alert('Informe o nome do pet'); return } setEtapa('vacinas'); window.scrollTo({ top: 0 }) }}
                className="flex-1 py-4 bg-brand-purple text-white font-bold rounded-2xl"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — VACINAS */}
        {etapa === 'vacinas' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              Cartão de vacinas{nomePet ? ` — ${nomePet}` : ''}
            </h2>
            <p className="text-sm text-gray-500">Anexe uma foto ou PDF do cartão de vacinas. Nossa equipe confere as datas para você.</p>

            {/* Upload cartão */}
            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-3">
              <input ref={vacinaRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setCartaoFile(f) }} />
              {cartaoFile ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                    <span className="text-sm text-green-700 truncate">{cartaoFile.name}</span>
                  </div>
                  <button type="button" onClick={() => { setCartaoFile(null); if (vacinaRef.current) vacinaRef.current.value = '' }}
                    className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => vacinaRef.current?.click()}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-brand-purple bg-purple-50 flex items-center justify-center gap-3 text-brand-purple font-semibold"
                >
                  <Camera size={20} /> Anexar cartão de vacinas
                </button>
              )}
              <p className="text-xs text-gray-400 text-center">Se não tiver o cartão em mãos agora, pode enviar depois pelo WhatsApp.</p>
            </section>

            {/* Tem mais um cão? */}
            <button
              type="button"
              onClick={adicionarOutroCao}
              disabled={loading}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-brand-purple bg-purple-50 flex items-center justify-center gap-2 text-brand-purple font-bold disabled:opacity-50"
            >
              <Plus size={20} /> Tenho outro cão — cadastrar mais um
            </button>

            <div className="flex gap-3">
              <button onClick={() => { setEtapa('pet'); window.scrollTo({ top: 0 }) }} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
                ← Voltar
              </button>
              <button
                onClick={enviar}
                disabled={loading}
                className="flex-1 py-4 bg-brand-orange text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : 'Finalizar cadastro'}
              </button>
            </div>
            {petsSalvos.length > 0 && (
              <p className="text-xs text-gray-400 text-center -mt-1">
                Ao finalizar, {petsSalvos.length + 1} cães serão cadastrados de uma só vez.
              </p>
            )}
            <div className="pb-8" />
          </div>
        )}
      </div>
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [display, setDisplay] = React.useState(() => {
    if (!value) return ''
    const [y, m, d] = value.split('-')
    return y && m && d ? `${d}/${m}/${y}` : ''
  })
  React.useEffect(() => {
    if (!value) setDisplay('')
  }, [value])
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let masked = digits
    if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    setDisplay(masked)
    if (digits.length === 8) {
      const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8)
      onChange(`${y}-${m}-${d}`)
    } else {
      onChange('')
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input type="text" inputMode="numeric" value={display} onChange={handle} placeholder="DD/MM/AAAA"
        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none" />
    </div>
  )
}
