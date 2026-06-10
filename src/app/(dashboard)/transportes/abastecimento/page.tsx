'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, Fuel, X } from 'lucide-react'
import Link from 'next/link'

// Fluxo de posto: 3 campos numéricos grandes + foto opcional do cupom.
// Máximo de 20 segundos.

export default function AbastecimentoPage() {
  const router = useRouter()
  const [km, setKm] = useState('')
  const [litros, setLitros] = useState('')
  const [valor, setValor] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function escolherFoto(f: File | null) {
    setFoto(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function salvar() {
    setErro('')
    const fd = new FormData()
    fd.set('km', km)
    fd.set('litros', litros)
    fd.set('valor', valor)
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

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={40} className="text-green-500" />
        </div>
        <p className="text-xl font-bold text-gray-900">Abastecimento registrado!</p>
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

      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">Km do painel</label>
        <input autoFocus type="text" inputMode="decimal" placeholder="0"
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

      {/* Foto do cupom (opcional, câmera direto) */}
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
          <img src={preview} alt="Cupom" className="w-full max-h-56 object-contain rounded-2xl bg-gray-100" />
          <button onClick={() => escolherFoto(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="py-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold flex items-center justify-center gap-2">
          <Camera size={20} /> Foto do cupom (opcional)
        </button>
      )}

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-5 rounded-2xl bg-brand-orange text-white font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando
          ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Check size={22} /> Salvar</>}
      </button>
    </div>
  )
}
