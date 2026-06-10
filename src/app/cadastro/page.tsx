'use client'

import React, { useState, useRef } from 'react'
import { Dog, Camera, X, CheckCircle, Loader2 } from 'lucide-react'
import type { Porte, PlanoTipo } from '@/types'

const PORTE_LABELS: Record<Porte, string> = { P: 'Pequeno', M: 'Médio', G: 'Grande' }

export default function CadastroPublicoPage() {
  const [etapa, setEtapa] = useState<'tutor' | 'pet' | 'vacinas' | 'sucesso'>('tutor')
  const [loading, setLoading] = useState(false)
  const [analisandoVacinas, setAnalisandoVacinas] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const vacinaRef = useRef<HTMLInputElement>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  // Tutor
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [endereco, setEndereco] = useState('')

  // Pet
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
  const [msgVacina, setMsgVacina] = useState('')

  const planos: { value: PlanoTipo; label: string; desc: string }[] = [
    { value: 'diaria_avulsa', label: 'Diária Avulsa', desc: 'Sem mensalidade, paga por dia' },
    { value: 'pacote_semanal', label: 'Pacote Semanal', desc: '5 diárias por semana' },
    { value: 'pacote_mensal', label: 'Pacote Mensal', desc: 'Frequência mensal fixa' },
    { value: 'hotel', label: 'Hotel', desc: 'Hospedagem / pernoite' },
  ]

  async function analisarCartaoVacinas(file: File) {
    setAnalisandoVacinas(true)
    setMsgVacina('Analisando o cartão com IA...')
    const fd = new FormData()
    fd.append('arquivo', file)
    try {
      const res = await fetch('/api/analisar-vacinas', { method: 'POST', body: fd })
      const dados = await res.json()
      if (dados.vacina_v8_v10) setVacinaV8(dados.vacina_v8_v10)
      if (dados.vacina_antirabica) setVacinaRaiva(dados.vacina_antirabica)
      if (dados.vacina_gripe) setVacinaGripe(dados.vacina_gripe)
      setMsgVacina('Campos preenchidos automaticamente! Confira e ajuste se necessário.')
    } catch {
      setMsgVacina('Não consegui ler o cartão. Preencha manualmente.')
    }
    setAnalisandoVacinas(false)
  }

  async function enviar() {
    setLoading(true)

    // Upload da foto se houver
    let fotoUrl: string | null = null
    if (fotoFile) {
      const fd = new FormData()
      fd.append('arquivo', fotoFile)
      fd.append('pasta', 'pets-publico')
      // Faz upload via endpoint separado para não expor service key
      try {
        const r = await fetch('/api/upload-foto-pet', { method: 'POST', body: fd })
        const d = await r.json()
        if (d.url) fotoUrl = d.url
      } catch { /* segue sem foto */ }
    }

    const res = await fetch('/api/cadastro-publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor: { nome, telefone, cpf, endereco },
        pet: {
          nome: nomePet, raca, porte, data_nascimento: nascimento,
          castrado, restricoes, medicacao, plano,
          vacina_v8_v10: vacinaV8, vacina_antirabica: vacinaRaiva, vacina_gripe: vacinaGripe,
          foto_url: fotoUrl,
        },
      }),
    })

    setLoading(false)
    if (res.ok) {
      setEtapa('sucesso')
    } else {
      alert('Ocorreu um erro. Tente novamente.')
    }
  }

  if (etapa === 'sucesso') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cadastro realizado!</h1>
          <p className="text-gray-500 mb-1">Olá, <strong>{nome}</strong>!</p>
          <p className="text-gray-500">
            <strong>{nomePet}</strong> está cadastrado(a) na Play Dog. Em breve nossa equipe entrará em contato.
          </p>
          <div className="mt-6 p-4 bg-purple-50 rounded-2xl">
            <p className="text-xs text-purple-600 font-medium">Guarde nosso número</p>
            <p className="text-sm text-gray-700 mt-1">WhatsApp Play Dog</p>
          </div>
        </div>
      </div>
    )
  }

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
            <h2 className="text-xl font-bold text-gray-900 mt-2">Dados do pet</h2>

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
              <button onClick={() => setEtapa('tutor')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
                ← Voltar
              </button>
              <button
                onClick={() => { if (!nomePet) { alert('Informe o nome do pet'); return } setEtapa('vacinas') }}
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
            <h2 className="text-xl font-bold text-gray-900 mt-2">Cartão de vacinas</h2>
            <p className="text-sm text-gray-500">Tire uma foto do cartão de vacinas e a IA preenche os campos automaticamente.</p>

            {/* Upload cartão */}
            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-3">
              <input ref={vacinaRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) analisarCartaoVacinas(f) }} />
              <button
                type="button"
                onClick={() => vacinaRef.current?.click()}
                disabled={analisandoVacinas}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-brand-purple bg-purple-50 flex items-center justify-center gap-3 text-brand-purple font-semibold disabled:opacity-50"
              >
                {analisandoVacinas ? (
                  <><Loader2 size={20} className="animate-spin" /> Analisando...</>
                ) : (
                  <><Camera size={20} /> Foto do cartão de vacinas</>
                )}
              </button>
              {msgVacina && (
                <p className={`text-xs text-center font-medium ${msgVacina.includes('Campos') ? 'text-green-600' : 'text-gray-500'}`}>
                  {msgVacina}
                </p>
              )}
            </section>

            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Confirme as datas (última dose)</h3>
              <Field label="V8 / V10 (polivalente)" value={vacinaV8} onChange={setVacinaV8} type="date" />
              <Field label="Antirrábica" value={vacinaRaiva} onChange={setVacinaRaiva} type="date" />
              <Field label="Gripe (tosse dos canis)" value={vacinaGripe} onChange={setVacinaGripe} type="date" />
            </section>

            <div className="flex gap-3">
              <button onClick={() => setEtapa('pet')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
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
