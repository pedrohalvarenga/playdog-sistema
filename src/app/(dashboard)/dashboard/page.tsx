import { createClient } from '@/lib/supabase/server'
import { Dog, CalendarCheck, Users, TrendingUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import type { Profile } from '@/types'
import Link from 'next/link'

async function getStats() {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const [presencasHoje, totalPets, totalTutores] = await Promise.all([
    supabase.from('presencas').select('id', { count: 'exact' }).eq('data', hoje).is('checkout_at', null),
    supabase.from('pets').select('id', { count: 'exact' }).eq('ativo', true),
    supabase.from('tutores').select('id', { count: 'exact' }),
  ])

  return {
    petsPresentes: presencasHoje.count ?? 0,
    totalPets: totalPets.count ?? 0,
    totalTutores: totalTutores.count ?? 0,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single<Profile>()

  const stats = await getStats()
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

          <Link href="/pets/novo" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Dog size={24} className="text-brand-orange" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Cadastrar Pet</p>
              <p className="text-sm text-gray-400">Novo pet ou tutor</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
