'use client'

import { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { Camera, X, Check, ZoomIn, ZoomOut } from 'lucide-react'

interface Point { x: number; y: number }
interface Area { x: number; y: number; width: number; height: number }

interface Props {
  fotoAtual?: string | null
  onFotoProcessada: (file: File, previewUrl: string) => void
  onRemover: () => void
  previewUrl?: string | null
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  const size = Math.min(pixelCrop.width, pixelCrop.height)
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)
  return new Promise((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92))
}

export default function FotoComCrop({ fotoAtual, onFotoProcessada, onRemover, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [imagemBruta, setImagemBruta] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)

  const fotoExibida = previewUrl ?? fotoAtual

  function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagemBruta(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    e.target.value = ''
  }

  const onCropComplete = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedArea(pixelCrop)
  }, [])

  async function confirmar() {
    if (!imagemBruta || !croppedArea) return
    const blob = await getCroppedBlob(imagemBruta, croppedArea)
    const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' })
    const preview = URL.createObjectURL(blob)
    onFotoProcessada(file, preview)
    setImagemBruta(null)
  }

  function cancelar() {
    setImagemBruta(null)
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onArquivoSelecionado} />

      {/* Modal de crop */}
      {imagemBruta && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Área do crop */}
          <div className="relative flex-1">
            <Cropper
              image={imagemBruta}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape="round"
              showGrid={false}
            />
          </div>

          {/* Controles de zoom */}
          <div className="bg-black px-6 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <ZoomOut size={20} className="text-white flex-shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-purple-500"
              />
              <ZoomIn size={20} className="text-white flex-shrink-0" />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelar}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 text-white font-semibold"
              >
                <X size={18} /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-purple text-white font-semibold"
              >
                <Check size={18} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview / botão de adicionar */}
      {fotoExibida ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoExibida} alt="Foto do pet" className="w-32 h-32 rounded-full object-cover border-4 border-brand-purple/20" />
            <button
              type="button"
              onClick={() => { onRemover(); }}
              className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
            >
              <X size={14} />
            </button>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="text-xs text-brand-purple font-semibold">
            Trocar foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-brand-purple hover:text-brand-purple transition-colors"
        >
          <Camera size={28} />
          <span className="text-xs font-medium text-center">Adicionar foto</span>
        </button>
      )}
    </>
  )
}
