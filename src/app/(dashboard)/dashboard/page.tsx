import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Dog, CalendarCheck, Stethoscope, UtensilsCrossed, TrendingUp, Car, AlertTriangle, ChevronRight, ListTodo } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/financeiro'
import { STATUS_ROTA_LABELS, STATUS_ROTA_CORES } from '@/lib/transporte'
import type { Rota, Transporte } from '@/types/transporte'
import type { Profile } from '@/types'
import Link from 'next/link'
import { hojeLocal, horaLocal } from '@/lib/datas'
import { menusVisiveis } from '@/lib/menus'

async function getStats() {
  const supabase = await createClient()
  const hoje = hojeLocal()

  const inicioMes = hoje.slice(0, 8) + '01'

  const [presencasHoje, totalPetsRes, receitasMes, vetHojeRes] = await Promise.all([
    supabase.from('presencas').select('id', { count: 'exact' }).eq('data', hoje).is('checkout_at', null),
    supabase.from('pets').select('id', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('receitas').select('valor, valor_liquido').eq('status', 'pago').gte('data', inicioMes).lte('data', hoje),
    supabase.from('agendamentos_veterinario').select('id', { count: 'exact', head: true })
      .eq('data', hoje).neq('status', 'cancelado'),
  ])

  const receitaMes = ((receitasMes.data ?? []) as { valor: number; valor_liquido: number | null }[])
    .reduce((s, r) => s + (r.valor_liquido ?? r.valor), 0)

  return {
    petsPresentes: presencasHoje.count ?? 0,
    totalPets: totalPetsRes.count ?? 0,
    vetHoje: vetHojeRes.count ?? 0,
    receitaMes,
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

// Minhas tarefas atrasadas: pendentes de dias anteriores ou com horário de hoje já vencido.
async function getMinhasTarefasAtrasadas(userId: string) {
  const supabase = await createClient()
  const hoje = hojeLocal()
  const agora = horaLocal()
  const { data } = await supabase
    .from('tarefas')
    .select('id, data, horario')
    .eq('atribuido_para', userId)
    .eq('status', 'pendente')
    .lte('data', hoje)
  const rows = (data ?? []) as { id: string; data: string; horario: string | null }[]
  return rows.filter(t => t.data < hoje || (t.data === hoje && !!t.horario && t.horario.slice(0, 5) < agora)).length
}

// Quantas tarefas o usuário tem pendentes (de hoje ou de dias anteriores).
async function getMinhasTarefasPendentes(userId: string) {
  const supabase = await createClient()
  const hoje = hojeLocal()
  const { count } = await supabase
    .from('tarefas')
    .select('id', { count: 'exact', head: true })
    .eq('atribuido_para', userId)
    .eq('status', 'pendente')
    .lte('data', hoje)
  return count ?? 0
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single<Profile>()

  // Motorista trabalha só com o transporte
  if (profile?.role === 'motorista') redirect('/transportes')

  const stats = await getStats()
  const rotasHoje = await getRotasHoje()
  const tarefasAtrasadas = await getMinhasTarefasAtrasadas(user!.id)
  // O card de receita só aparece para quem tem o menu Financeiro habilitado.
  const temFinanceiro = profile
    ? menusVisiveis(profile.role, profile.menus).some(m => m.key === 'financeiro')
    : false
  const tarefasPendentes = temFinanceiro ? 0 : await getMinhasTarefasPendentes(user!.id)
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

      {/* Lembrete de tarefas atrasadas */}
      {tarefasAtrasadas > 0 && (
        <Link href="/tarefas"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 active:bg-red-100">
          <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-700 text-sm">
              {tarefasAtrasadas} tarefa{tarefasAtrasadas !== 1 ? 's' : ''} atrasada{tarefasAtrasadas !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600">Já deveria ter sido feita — toque para ver</p>
          </div>
          <ChevronRight size={20} className="text-red-300 flex-shrink-0" />
        </Link>
      )}

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

        <Link href="/veterinario">
          <Card className="h-full active:scale-98 transition-transform">
            <Stethoscope size={28} className="mb-2 text-rose-500" />
            <p className="text-3xl font-bold text-gray-900">{stats.vetHoje}</p>
            <p className="text-sm text-gray-500">Consultas vet hoje</p>
          </Card>
        </Link>

        {temFinanceiro ? (
          <Link href="/financeiro">
            <Card className="bg-brand-orange text-white h-full active:scale-98 transition-transform">
              <TrendingUp size={28} className="mb-2 opacity-80" />
              <p className="text-2xl font-bold">{formatCurrency(stats.receitaMes)}</p>
              <p className="text-sm opacity-80">Receita do mês (recebida)</p>
            </Card>
          </Link>
        ) : (
          <Link href="/tarefas">
            <Card className="bg-brand-purple text-white h-full active:scale-98 transition-transform">
              <ListTodo size={28} className="mb-2 opacity-80" />
              <p className="text-3xl font-bold">{tarefasPendentes}</p>
              <p className="text-sm opacity-80">Minhas tarefas{tarefasPendentes !== 1 ? ' pendentes' : ' pendente'}</p>
            </Card>
          </Link>
        )}
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
          <Link href="/alimentacao-medicacao" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <UtensilsCrossed size={24} className="text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Alimentação</p>
              <p className="text-sm text-gray-400">Alimentação e medicação dos pets</p>
            </div>
          </Link>

          <Link href="/tarefas" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              <ListTodo size={24} className="text-brand-purple" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Tarefas do Dia</p>
              <p className="text-sm text-gray-400">Checklist da equipe</p>
            </div>
          </Link>

          <Link href="/transportes" className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Car size={24} className="text-brand-orange" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Transporte</p>
              <p className="text-sm text-gray-400">Corridas de hoje e agenda</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
