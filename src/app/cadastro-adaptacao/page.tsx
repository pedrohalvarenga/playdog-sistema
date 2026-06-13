'use client'

import React, { useState, useRef } from 'react'
import { Dog, Camera, X, CheckCircle, Loader2, CalendarHeart } from 'lucide-react'
import type { Porte } from '@/types'

const PORTE_LABELS: Record<Porte, string> = { P: 'Pequeno', M: 'Médio', G: 'Grande' }

export default function CadastroAdaptacaoPage() {
  const [etapa, setEtapa] = useState<'tutor' | 'pet' | 'agendamento' | 'sucesso'>('tutor')
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

  // Pet
  const [nomePet, setNomePet] = useState('')
  const [raca, setRaca] = useState('')
  const [porte, setPorte] = useState<Porte>('M')
  const [nascimento, setNascimento] = useState('')
  const [castrado, setCastrado] = useState(false)
  const [restricoes, setRestricoes] = useState('')

  // Adaptação
  const [dataAdaptacao, setDataAdaptacao] = useState('')
  const [horaEntrada, setHoraEntrada] = useState('')
  const [horaSaida, setHoraSaida] = useState('')

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
    if (!dataAdaptacao || !horaEntrada) { alert('Informe o dia e horário de entrada da adaptação'); return }
    setLoading(true)

    const fotoUrl = await uploadFoto(fotoFile)
    const cartaoUrl = await uploadFoto(cartaoFile)

    const res = await fetch('/api/cadastro-adaptacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor: { nome, telefone, cpf, endereco },
        pet: {
          nome: nomePet, raca, porte, data_nascimento: nascimento,
          castrado, restricoes,
          foto_url: fotoUrl, cartao_vacinas_url: cartaoUrl,
        },
        adaptacao: { data: dataAdaptacao, hora_entrada: horaEntrada, hora_saida: horaSaida || null },
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
    const [y, m, d] = dataAdaptacao.split('-')
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Adaptação agendada!</h1>
          <p className="text-gray-500 mb-1">Olá, <strong>{nome}</strong>!</p>
          <p className="text-gray-500">
            A adaptação de <strong>{nomePet}</strong> está marcada para{' '}
            <strong>{d}/{m}/{y}</strong> às <strong>{horaEntrada}</strong>.
          </p>
          <div className="mt-6 p-4 bg-purple-50 rounded-2xl">
            <p className="text-xs text-purple-600 font-medium">Até lá! 🐶</p>
            <p className="text-sm text-gray-700 mt-1">Equipe Play Dog</p>
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
          <CalendarHeart size={28} />
        </div>
        <h1 className="text-2xl font-bold">Play Dog</h1>
        <p className="text-white/70 text-sm mt-1">Agendamento de adaptação</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-4 py-3 bg-white shadow-sm">
        {(['tutor', 'pet', 'agendamento'] as const).map((e, i) => (
          <div key={e} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${
              etapa === e || (i === 0 && etapa !== 'tutor') || (i === 1 && etapa === 'agendamento')
                ? 'bg-brand-purple' : 'bg-gray-200'
            }`} />
            <span className="text-[10px] text-gray-400">
              {e === 'tutor' ? 'Seus dados' : e === 'pet' ? 'Seu pet' : 'Dia e horário'}
            </span>
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
              onClick={() => { if (!nome || !telefone) { alert('Preencha nome e WhatsApp'); return } setEtapa('pet'); window.scrollTo({ top: 0 }) }}
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

              <TextArea label="Restrições / Comportamento" value={restricoes} onChange={setRestricoes}
                placeholder="Ex: Briga com outros machos, tem medo de barulho..." />
            </section>

            {/* Cartão de vacinas */}
            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Cartão de vacinas</h3>
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

            <div className="flex gap-3">
              <button onClick={() => { setEtapa('tutor'); window.scrollTo({ top: 0 }) }} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
                ← Voltar
              </button>
              <button
                onClick={() => { if (!nomePet) { alert('Informe o nome do pet'); return } setEtapa('agendamento'); window.scrollTo({ top: 0 }) }}
                className="flex-1 py-4 bg-brand-purple text-white font-bold rounded-2xl"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — DIA E HORÁRIO */}
        {etapa === 'agendamento' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              Dia da adaptação{nomePet ? ` — ${nomePet}` : ''}
            </h2>
            <p className="text-sm text-gray-500">
              Escolha o dia e os horários combinados com a nossa equipe para o período de adaptação.
            </p>

            <section className="bg-white rounded-3xl p-4 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Dia da adaptação *</label>
                <input type="date" value={dataAdaptacao} onChange={e => setDataAdaptacao(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">Horário de entrada *</label>
                  <input type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">Horário de saída</label>
                  <input type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
                </div>
              </div>
            </section>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-blue-700">
                <Dog size={14} className="inline mr-1" />
                A adaptação é o primeiro dia do seu cão na Play Dog — um período curto para
                ele conhecer o espaço, os amigos e a nossa equipe.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setEtapa('pet'); window.scrollTo({ top: 0 }) }} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">
                ← Voltar
              </button>
              <button
                onClick={enviar}
                disabled={loading}
                className="flex-1 py-4 bg-brand-orange text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : 'Agendar adaptação'}
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
