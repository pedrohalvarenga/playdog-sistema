import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, calcIdade, PLANO_LABELS, PORTE_LABELS } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { Dog, Phone, Calendar, Syringe, ArrowLeft, Edit } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Pet } from '@/types'

type PetComTutor = Pet & { tutor: { id: string; nome: string; telefone: string; whatsapp?: string } }

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: pet } = await supabase
    .from('pets')
    .select('*, tutor:tutores(*)')
    .eq('id', id)
    .single<PetComTutor>()

  if (!pet) notFound()

  const { data: historico } = await supabase
    .from('presencas')
    .select('*')
    .eq('pet_id', id)
    .order('data', { ascending: false })
    .limit(10)

  const vacinas = [
    { label: 'V8/V10', data: pet.vacina_v8_v10 },
    { label: 'Antirrábica', data: pet.vacina_antirabica },
    { label: 'Gripe', data: pet.vacina_gripe },
  ]

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/pets" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <Link href={`/pets/${id}/editar`} className="p-2 rounded-xl text-gray-400">
          <Edit size={22} />
        </Link>
      </div>

      {/* Header do pet */}
      <div className="flex items-center gap-4 bg-brand-purple rounded-3xl p-5 text-white">
        <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {pet.foto_url ? (
            <Image src={pet.foto_url} alt={pet.nome} width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <Dog size={36} className="text-white" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{pet.nome}</h1>
          {pet.raca && <p className="text-white/80 text-sm">{pet.raca}</p>}
          <div className="flex gap-2 mt-2">
            <Badge variant="gray" className="bg-white/20 text-white">{PORTE_LABELS[pet.porte]}</Badge>
            <Badge variant="gray" className="bg-white/20 text-white">{pet.castrado ? 'Castrado' : 'Não castrado'}</Badge>
          </div>
        </div>
      </div>

      {/* Tutor */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Phone size={18} className="text-brand-orange" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Tutor</p>
            <p className="font-bold text-gray-900">{pet.tutor.nome}</p>
            <p className="text-sm text-gray-500">{pet.tutor.telefone}</p>
          </div>
        </div>
      </Card>

      {/* Plano */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">Plano contratado</p>
            <Badge variant="orange" className="text-sm">{PLANO_LABELS[pet.plano]}</Badge>
          </div>
          {pet.data_nascimento && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Idade</p>
              <p className="font-bold text-gray-900">{calcIdade(pet.data_nascimento)}</p>
              <p className="text-xs text-gray-400">{formatDate(pet.data_nascimento)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Restrições */}
      {pet.restricoes && (
        <Card className="border-l-4 border-brand-orange">
          <p className="text-xs text-brand-orange font-semibold mb-1">⚠️ Restrições / Comportamento</p>
          <p className="text-sm text-gray-700">{pet.restricoes}</p>
        </Card>
      )}

      {/* Vacinas */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Syringe size={18} className="text-brand-teal" />
          <p className="font-bold text-gray-900 text-sm">Vacinas</p>
        </div>
        <div className="flex flex-col gap-2">
          {vacinas.map(v => (
            <div key={v.label} className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{v.label}</p>
              {v.data ? (
                <Badge variant="green">{formatDate(v.data)}</Badge>
              ) : (
                <Badge variant="red">Não informada</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Histórico */}
      {historico && historico.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-brand-purple" />
            <p className="font-bold text-gray-900 text-sm">Últimas presenças</p>
          </div>
          <div className="flex flex-col gap-2">
            {historico.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <p className="text-gray-700">{formatDate(p.data)}</p>
                <p className="text-gray-400 text-xs">
                  {p.checkin_at ? formatDate(p.checkin_at, 'HH:mm') : '—'} → {p.checkout_at ? formatDate(p.checkout_at, 'HH:mm') : 'presente'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
