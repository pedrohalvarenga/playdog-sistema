import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, calcIdade, PLANO_LABELS, PORTE_LABELS, vacinaStatus, whatsappUrl } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { Dog, Phone, Calendar, Syringe, ArrowLeft, Edit, Pill, MessageCircle, AlertTriangle, CreditCard, SlidersHorizontal, Plus } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Pet } from '@/types'
import AdminActions from '@/components/AdminActions'

type PetComTutor = Pet & { tutor: { id: string; nome: string; telefone: string; whatsapp?: string } }

const AREA_SERVICO_LABELS: Record<string, string> = {
  creche: 'Creche', hotel: 'Hotel', banho_tosa: 'Banho e Tosa', adaptacao: 'Adaptação',
}
const AREA_SERVICO_CORES: Record<string, string> = {
  creche: 'bg-purple-100 text-purple-700',
  hotel: 'bg-blue-100 text-blue-700',
  banho_tosa: 'bg-teal-100 text-teal-700',
  adaptacao: 'bg-yellow-100 text-yellow-700',
}

function VacinaBadge({ data }: { data?: string | null }) {
  const status = vacinaStatus(data)
  if (status === 'sem_data') return <Badge variant="red">Não informada</Badge>
  if (status === 'nao_vacinado') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      Não vacinado
    </span>
  )
  if (status === 'vencida') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <AlertTriangle size={11} /> Vencida — {formatDate(data!)}
    </span>
  )
  if (status === 'atencao') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      <AlertTriangle size={11} /> Vencendo — {formatDate(data!)}
    </span>
  )
  return <Badge variant="green">{formatDate(data!)}</Badge>
}

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  const isAdmin = perfil?.role === 'admin'

  const { data: pet } = await supabase
    .from('pets')
    .select('*, tutor:tutores(*)')
    .eq('id', id)
    .single<PetComTutor>()

  if (!pet) notFound()

  const [{ data: historico }, { data: ocorrencias }] = await Promise.all([
    supabase.from('presencas').select('*').eq('pet_id', id).order('data', { ascending: false }).limit(10),
    supabase.from('ocorrencias').select('*').eq('pet_id', id).order('created_at', { ascending: false }).limit(5),
  ])

  const p = pet as any
  const vacinas = [
    { label: 'V7/V8/V10 ou sorologia', data: pet.vacina_v8_v10 },
    { label: 'Antirrábica', data: pet.vacina_antirabica },
    { label: 'Gripe', data: pet.vacina_gripe },
    { label: 'Giardia', data: p.vacina_giardia },
  ]

  const temVacinaVencida = vacinas.some(v => vacinaStatus(v.data) === 'vencida')
  const temVacinaAtencao = vacinas.some(v => vacinaStatus(v.data) === 'atencao')

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

      {/* Alerta de vacina vencida */}
      {temVacinaVencida && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-700">Vacina(s) vencida(s)! Atualização necessária.</p>
        </div>
      )}
      {!temVacinaVencida && temVacinaAtencao && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-yellow-700">Vacina(s) vencendo em breve. Agende a dose de reforço.</p>
        </div>
      )}

      {/* Header do pet */}
      <div className={`flex items-center gap-4 rounded-3xl p-5 text-white ${temVacinaVencida ? 'bg-red-500' : 'bg-brand-purple'}`}>
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
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="gray" className="bg-white/20 text-white">{PORTE_LABELS[pet.porte]}</Badge>
            <Badge variant="gray" className="bg-white/20 text-white">{pet.castrado ? 'Castrado' : 'Não castrado'}</Badge>
          </div>
        </div>
      </div>

      {/* Áreas de serviço */}
      {(p.areas_servico?.length ?? 0) > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(p.areas_servico as string[]).map((a: string) => (
            <span key={a} className={`px-3 py-1 rounded-full text-xs font-semibold ${AREA_SERVICO_CORES[a] ?? 'bg-gray-100 text-gray-600'}`}>
              {AREA_SERVICO_LABELS[a] ?? a}
            </span>
          ))}
        </div>
      )}

      {/* Tutor */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Phone size={18} className="text-brand-orange" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Tutor</p>
              <Link href={`/tutores/${pet.tutor.id}`} className="font-bold text-gray-900 hover:text-brand-purple">{pet.tutor.nome}</Link>
              <p className="text-sm text-gray-500">{pet.tutor.telefone}</p>
            </div>
          </div>
          {pet.tutor.telefone && (
            <a
              href={whatsappUrl(pet.tutor.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
          )}
        </div>
      </Card>

      {/* Saldo de diárias */}
      <Card className={p.saldo_diarias < 0 ? 'border-2 border-red-300 bg-red-50' : p.saldo_diarias === 0 ? 'border-2 border-yellow-200' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">Saldo de diárias</p>
            <p className={`text-2xl font-bold ${p.saldo_diarias < 0 ? 'text-red-600' : p.saldo_diarias === 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {p.saldo_diarias} diária{p.saldo_diarias !== 1 ? 's' : ''}
            </p>
            {p.saldo_diarias < 0 && <p className="text-xs text-red-500 font-semibold mt-0.5">Saldo negativo</p>}
          </div>
          <div className="flex gap-2">
            <Link href={`/creche/comprar-diarias/${id}`} className="flex items-center gap-1.5 bg-brand-purple text-white px-3 py-2 rounded-xl text-xs font-semibold">
              <CreditCard size={14} /> Comprar
            </Link>
            <Link href={`/creche/ajustar-saldo/${id}`} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold">
              <SlidersHorizontal size={14} /> Ajustar
            </Link>
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

      {/* Medicação */}
      {p.medicacao && (
        <Card className="border-l-4 border-brand-teal">
          <div className="flex items-center gap-2 mb-1">
            <Pill size={14} className="text-brand-teal" />
            <p className="text-xs text-brand-teal font-semibold">Medicação</p>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line">{p.medicacao}</p>
        </Card>
      )}

      {/* Vacinas */}
      <Card className={temVacinaVencida ? 'border-2 border-red-300' : temVacinaAtencao ? 'border-2 border-yellow-300' : ''}>
        <div className="flex items-center gap-2 mb-3">
          <Syringe size={18} className={temVacinaVencida ? 'text-red-500' : 'text-brand-teal'} />
          <p className="font-bold text-gray-900 text-sm">Vacinas</p>
          {temVacinaVencida && <span className="text-xs text-red-600 font-semibold">● Vencida</span>}
          {!temVacinaVencida && temVacinaAtencao && <span className="text-xs text-yellow-600 font-semibold">● A vencer</span>}
        </div>
        <div className="flex flex-col gap-2">
          {vacinas.map(v => (
            <div key={v.label} className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{v.label}</p>
              <VacinaBadge data={v.data} />
            </div>
          ))}
        </div>
      </Card>

      {/* Ocorrências */}
      <Card className={ocorrencias && ocorrencias.length > 0 ? 'border-l-4 border-yellow-400' : ''}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-500" />
            <p className="font-bold text-gray-900 text-sm">Ocorrências</p>
          </div>
          <Link href={`/pets/${id}/ocorrencia`} className="flex items-center gap-1 text-xs text-brand-purple font-semibold">
            <Plus size={14} /> Registrar
          </Link>
        </div>
        {ocorrencias && ocorrencias.length > 0 ? (
          <div className="flex flex-col gap-3">
            {ocorrencias.map((o: { id: string; descricao: string; created_at: string }) => (
              <div key={o.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <p className="text-xs text-gray-400">{formatDate(o.created_at, 'dd/MM/yyyy HH:mm')}</p>
                <p className="text-sm text-gray-700 mt-0.5">{o.descricao}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nenhuma ocorrência registrada</p>
        )}
      </Card>

      {/* Histórico */}
      {historico && historico.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-brand-purple" />
            <p className="font-bold text-gray-900 text-sm">Últimas presenças</p>
          </div>
          <div className="flex flex-col gap-2">
            {historico.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <p className="text-gray-700">{formatDate(h.data)}</p>
                <p className="text-gray-400 text-xs">
                  {h.checkin_at ? formatDate(h.checkin_at, 'HH:mm') : '—'} → {h.checkout_at ? formatDate(h.checkout_at, 'HH:mm') : 'presente'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ações admin */}
      {isAdmin && (
        <Card>
          <AdminActions tipo="pet" id={id} ativo={pet.ativo} nome={pet.nome} />
        </Card>
      )}
    </div>
  )
}
