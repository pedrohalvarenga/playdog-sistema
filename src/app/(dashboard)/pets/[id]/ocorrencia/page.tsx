'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { ArrowLeft, Camera, X } from 'lucide-react'
import Link from 'next/link'

export default function NovaOcorrenciaPage() {
  const params = useParams()
  const petId = params.id as string
  const router = useRouter()

  const [petNome, setPetNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('pets').select('nome').eq('id', petId).single()
      if (data) setPetNome(data.nome)
    }
    load()
  }, [petId])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) return
    setSalvando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let fotoUrl: string | null = null
    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop()
      const path = `ocorrencias/${petId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('pets-fotos')
        .upload(path, fotoFile, { upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('pets-fotos').getPublicUrl(path)
        fotoUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('ocorrencias').insert({
      pet_id: petId,
      descricao: descricao.trim(),
      foto_url: fotoUrl,
      registrado_por: user?.id,
    })

    if (error) { setSalvando(false); alert('Erro ao salvar'); return }
    router.push(`/pets/${petId}`)
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/pets/${petId}`} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nova Ocorrência</h1>
          {petNome && <p className="text-sm text-gray-400">{petNome}</p>}
        </div>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Descrição da ocorrência</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={5}
              autoFocus
              required
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none"
              placeholder="Descreva o que aconteceu: comportamento, machucado, vômito, briga, etc."
            />
          </div>

          {/* Foto */}
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              setFotoFile(f)
              setFotoPreview(URL.createObjectURL(f))
            }} />

          {fotoPreview ? (
            <div className="relative self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoPreview} alt="Foto" className="w-32 h-32 rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => { setFotoPreview(null); setFotoFile(null) }}
                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              className="self-start flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl px-4 py-3 text-gray-400 text-sm hover:border-brand-purple hover:text-brand-purple transition-colors"
            >
              <Camera size={18} /> Adicionar foto (opcional)
            </button>
          )}
        </div>

        <Button type="submit" size="lg" loading={salvando}>
          Registrar Ocorrência
        </Button>
      </form>
    </div>
  )
}
