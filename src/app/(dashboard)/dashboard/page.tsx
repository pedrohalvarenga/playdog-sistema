import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Dog, CalendarCheck, Users, TrendingUp, Moon, Scissors, Car } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { STATUS_ROTA_LABELS, STATUS_ROTA_CORES } from '@/lib/transporte'
import type { Rota, Transporte } from '@/types/transporte'
import type { Profile } from '@/types'
import Link from 'next/link'
import { hojeLocal } from '@/lib/datas'

async function getStats() {
  const supabase = await createClient()
  const hoje = hojeLocal()

  const [presencasHoje, totalPets, totalTutores, hospedadosHoje, banhoHoje] = await Promise.all([
    supabase.from('presencas').select('id', { count: 'exact' }).eq('data', hoje).is('checkout_at', null),
    supabase.from('pets').select('id', { count: 'exact' }).eq('ativo', true),
    supabase.from('tutores').select('id', { count: 'exact' }),
    supabase.from('hospedagens').select('id', { count: 'exact' }).eq('status', 'hospedado'),
    supabase.from('agendamentos_banho_tosa').select('id', { count: 'exact' })
      .eq('data', hoje).not('status', 'in', '(cancelado,entregue)'),
  ])

  return {
    petsPresentes: presencasHoje.count ?? 0,
    totalPets: totalPets.count ?? 0,
    totalTutores: totalTutores.count ?? 0,
    hospedados: hospedadosHoje.count ?? 0,
    banhoHoje: banhoHoje.count ?? 0,
  }
}

async function getRotasHoje() {
  const supabase = await createClient()
  const hoje = hojeLocal()
  const { data: rotas } = await supabase.from('rotas').select('*').eq('data', hoje).order('tipo')
  if (!rotas || rotas.length === 0) return []

  const { data: paradas } = await supabase
    .from('transportes')
    .select('id, rota_id, status')
    .in('rota_id', rotas.map(r => r.id))

  return (rotas as Rota[]).map(r => {
    const minhas = ((paradas ?? []) as Pick<Transporte, 'id' | 'rota_id' | 'status'>[]).filter(p => p.rota_id === r.id)
    return {
      ...r,
      total: minhas.length,
      feitas: minhas.filter(p => p.status === 'concluido').length,
    }
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single<Profile>()

  // Motorista trabalha só com o transporte
  if (profile?.role === 'motorista') redirect('/transportes')

  const stats = await getStats()
  const rotasHoje = await getRotasHoje()
  const hoje = formatDate(new Date(), "EEEE, dd 'de' MMMM")

  return (
    <div className="py-6 flex flex-col gap-6">
      {/* Saudação */}
      <div>
        <p className="text-gray-400 text-sm capitalize">{hoje}</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {profile?.nome.split(' ')[0]}! 👋
        </h1>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-brand-purple text-white">
          <Dog size={28} className="mb-2 opacity-80" />
          <p className="text-3xl font-bold">{stats.petsPresentes}</p>
          <p className="text-sm opacity-80">Pets na creche hoje</p>
        </Card>

        <Card>
          <CalendarCheck size={28} className="mb-2 text-brand-orange" />
          <p className="text-3xl font-bold text-gray-900">{stats.totalPets}</p>
          <p className="text-sm text-gray-500">Pets cadastrados</p>
        </Card>

        <Card>
          <Users size={28} className="mb-2 text-brand-teal" />
          <p className="text-3xl font-bold text-gray-900">{stats.totalTutores}</p>
          <p className="text-sm text-gray-500">Tutores</p>
        </Card>

        <Card className="bg-brand-orange text-white">
          <TrendingUp size={28} className="mb-2 opacity-80" />
          <p className="text-3xl font-bold">—</p>
          <p className="text-sm opacity-80">Receita do mês</p>
        </Card>
      </div>

      {/* Transporte: rotas do dia com progresso */}
      {rotasHoje.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Transporte hoje</h2>
          <div className="flex flex-col gap-2">
            {rotasHoje.map(r => (
              <Link key={r.id} href={`/transportes/rota/${r.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${r.tipo === 'coleta' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                  <Car size={24} className={r.tipo === 'coleta' ? 'text-blue-500' : 'text-brand-purple'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{r.tipo === 'coleta' ? 'Coleta' : 'Entrega'}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_ROTA_CORES[r.status]}`}>
                      {STATUS_ROTA_LABELS[r.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {r.feitas} de {r.total} {r.tipo === 'coleta' ? 'embarcados' : 'entregues'}
                  </p>
                </div>
                {r.total > 0 && (
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">{Math.round((r.feitas / r.total) * 100)}%</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ações rápidas</h2>
        <div className="flex flex-col gap-2">
          <Link href="/creche" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              <CalendarCheck size={24} className="text-brand-purple" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Controle de Presença</p>
              <p className="text-sm text-gray-400">Check-in e check-out de hoje</p>
            </div>
          </Link>

          <Link href="/hotel" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Moon size={24} className="text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Hotel — {stats.hospedados} hospedados</p>
              <p className="text-sm text-gray-400">Reservas e agenda do hotel</p>
            </div>
          </Link>

          <Link href="/hotel/reservas/nova" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Dog size={24} className="text-brand-orange" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Nova Reserva Hotel</p>
              <p className="text-sm text-gray-400">Agendar hospedagem</p>
            </div>
          </Link>

          <Link href="/banho-tosa" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center">
              <Scissors size={24} className="text-brand-teal" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                Banho &amp; Tosa
                {stats.banhoHoje > 0 && (
                  <span className="ml-2 text-xs bg-brand-teal text-white px-2 py-0.5 rounded-full">
                    {stats.banhoHoje} hoje
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-400">Agendamentos e agenda</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
