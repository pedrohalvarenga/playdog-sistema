'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, Fuel, X, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function AbastecimentoPage() {
  const router = useRouter()
  const [km, setKm] = useState('')
  const [litros, setLitros] = useState('')
  const [valor, setValor] = useState('')
  const [valorLitro, setValorLitro] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [msgIA, setMsgIA] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function escolherFoto(f: File | null) {
    setFoto(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
    if (f) analisarComprovante(f)
  }

  async function analisarComprovante(f: File) {
    setAnalisando(true)
    setMsgIA('Analisando cupom com IA...')
    const fd = new FormData()
    fd.append('arquivo', f)
    try {
      const res = await fetch('/api/transporte/analisar-comprovante', { method: 'POST', body: fd })
      const dados = await res.json()
      if (dados.valor_total != null) setValor(String(dados.valor_total).replace('.', ','))
      if (dados.litros != null) setLitros(String(dados.litros).replace('.', ','))
      if (dados.valor_litro != null) setValorLitro(String(dados.valor_litro).replace('.', ','))
      if (dados.km != null) setKm(String(dados.km))
      if (dados.data) setData(dados.data)
      setMsgIA('Campos preenchidos! Confira e ajuste se necessário.')
    } catch {
      setMsgIA('Não consegui ler o cupom. Preencha manualmente.')
    }
    setAnalisando(false)
  }

  async function salvar() {
    setErro('')
    const fd = new FormData()
    fd.set('km', km)
    fd.set('litros', litros)
    fd.set('valor', valor)
    fd.set('data', data)
    if (foto) fd.set('arquivo', foto)

    setSalvando(true)
    const res = await fetch('/api/transporte/abastecimento', { method: 'POST', body: fd })
    const json = await res.json()
    setSalvando(false)

    if (!res.ok) { setErro(json.error ?? 'Erro ao salvar.'); return }
    setOk(true)
    setTimeout(() => router.push('/transportes'), 1200)
  }

  const campoCls = 'w-full px-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-3xl font-bold text-center'
  const campoSmCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-xl font-bold text-center'

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={40} className="text-green-500" />
        </div>
        <p className="text-xl font-bold text-gray-900">Abastecimento registrado!</p>
        <p className="text-sm text-gray-500">Despesa lançada automaticamente.</p>
      </div>
    )
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/transportes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Fuel size={22} className="text-brand-orange" /> Abastecimento
        </h1>
      </div>

      {/* Foto do cupom — primeiro para disparar IA */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => escolherFoto(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Cupom" className="w-full max-h-56 object-contain rounded-2xl bg-gray-100" />
          <button onClick={() => escolherFoto(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
            <X size={16} />
          </button>
          {analisando && (
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center gap-2">
              <Loader2 size={28} className="text-white animate-spin" />
              <p className="text-white text-sm font-semibold">Analisando com IA...</p>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="py-6 rounded-2xl border-2 border-dashed border-brand-orange bg-orange-50 text-brand-orange font-semibold flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <Camera size={22} />
            <span>Fotografar cupom</span>
          </div>
          <div className="flex items-center gap-1 text-xs opacity-70">
            <Sparkles size={12} />
            <span>IA preenche os campos automaticamente</span>
          </div>
        </button>
      )}

      {msgIA && (
        <p className={`text-xs text-center font-medium px-3 py-2 rounded-xl ${msgIA.includes('preenchidos') ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-50'}`}>
          {msgIA}
        </p>
      )}

      {/* Data */}
      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">Data</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)}
          className={campoSmCls} />
      </div>

      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">Km do painel</label>
        <input type="text" inputMode="decimal" placeholder="0"
          value={km} onChange={e => setKm(e.target.value)} className={campoCls} />
      </div>

      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">Litros</label>
        <input type="text" inputMode="decimal" placeholder="0,00"
          value={litros} onChange={e => setLitros(e.target.value)} className={campoCls} />
      </div>

      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">Valor total (R$)</label>
        <input type="text" inputMode="decimal" placeholder="0,00"
          value={valor} onChange={e => setValor(e.target.value)} className={campoCls} />
      </div>

      {valorLitro && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <Fuel size={16} className="text-brand-orange flex-shrink-0" />
          <p className="text-sm text-orange-800">
            <span className="font-semibold">R$ {valorLitro}</span> / litro
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando || analisando}
        className="py-5 rounded-2xl bg-brand-orange text-white font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando
          ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Check size={22} /> Salvar</>}
      </button>
    </div>
  )
}
