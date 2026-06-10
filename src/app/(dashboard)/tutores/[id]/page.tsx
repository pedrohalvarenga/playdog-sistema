import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, Phone, MapPin, FileText, Dog, Plus, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { PLANO_LABELS, PORTE_LABELS, whatsappUrl } from '@/lib/utils'
import type { Pet } from '@/types'
import AdminActions from '@/components/AdminActions'

export default async function TutorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  const isAdmin = perfil?.role === 'admin'

  const { data: tutor } = await supabase
    .from('tutores')
    .select('*')
    .eq('id', id)
    .single()

  if (!tutor) notFound()

  const { data: pets } = await supabase
    .from('pets')
    .select('*')
    .eq('tutor_id', id)
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/tutores" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <Link href={`/tutores/${id}/editar`} className="p-2 rounded-xl text-gray-400">
          <Edit size={22} />
        </Link>
      </div>

      {/* Header */}
      <div className="bg-brand-orange rounded-3xl p-5 text-white">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
          <span className="text-3xl font-bold">{tutor.nome.charAt(0).toUpperCase()}</span>
        </div>
        <h1 className="text-2xl font-bold">{tutor.nome}</h1>
        {tutor.telefone && <p className="text-white/80 text-sm mt-1">{tutor.telefone}</p>}
      </div>

      {/* Contato */}
      <Card>
        <div className="flex flex-col gap-3">
          {tutor.telefone && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-brand-orange flex-shrink-0" />
                <p className="text-sm text-gray-700">{tutor.telefone}</p>
              </div>
              <a
                href={whatsappUrl(tutor.telefone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            </div>
          )}
          {tutor.endereco && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-brand-orange flex-shrink-0" />
              <p className="text-sm text-gray-700">{tutor.endereco}</p>
            </div>
          )}
          {tutor.cpf && (
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-500">CPF: {tutor.cpf}</p>
            </div>
          )}
        </div>
      </Card>

      {tutor.observacoes && (
        <Card className="border-l-4 border-brand-orange">
          <p className="text-xs text-brand-orange font-semibold mb-1">Observações</p>
          <p className="text-sm text-gray-700">{tutor.observacoes}</p>
        </Card>
      )}

      {/* Pets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Cães ({pets?.length ?? 0})
          </h2>
          <Link
            href={`/pets/novo?tutor_id=${id}`}
            className="flex items-center gap-1 text-xs font-semibold text-brand-purple"
          >
            <Plus size={14} /> Cadastrar cão
          </Link>
        </div>

        {pets && pets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {(pets as Pet[]).map(pet => (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {pet.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pet.foto_url} alt={pet.nome} className="w-full h-full object-cover" />
                      ) : (
                        <Dog size={22} className="text-brand-purple" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{pet.nome}</p>
                      {pet.raca && <p className="text-xs text-gray-400">{pet.raca}</p>}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge variant="gray">{PORTE_LABELS[pet.porte]}</Badge>
                        <Badge variant="orange">{PLANO_LABELS[pet.plano]}</Badge>
                        {pet.castrado && <Badge variant="green">Castrado</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-4 text-gray-400">
              <Dog size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum cão cadastrado</p>
              <Link href={`/pets/novo?tutor_id=${id}`} className="text-brand-purple text-sm font-semibold mt-1 inline-block">
                + Cadastrar primeiro cão
              </Link>
            </div>
          </Card>
        )}
      </div>
      {/* Ações admin */}
      {isAdmin && (
        <Card>
          <AdminActions tipo="tutor" id={id} ativo={tutor.ativo ?? true} nome={tutor.nome} />
        </Card>
      )}
    </div>
  )
}
