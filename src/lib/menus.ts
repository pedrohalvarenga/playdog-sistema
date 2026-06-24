import {
  CalendarCheck, Building2, Scissors, Dog, Users, DollarSign,
  Home, Settings, Car, PawPrint, Briefcase, Truck, Stethoscope, UtensilsCrossed,
  ListTodo, type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types'

export interface MenuItem {
  key: string
  label: string
  sublabel: string
  href: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  defaultRoles: UserRole[]
}

// Catálogo único de menus do sistema.
// A ordem importa: os primeiros aparecem na barra inferior de acesso rápido;
// o restante vai para o menu "Mais".
export const MENUS: MenuItem[] = [
  { key: 'creche', label: 'Chamada', sublabel: 'Presenças da creche', href: '/creche', icon: CalendarCheck, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao'] },
  { key: 'hotel', label: 'Hotel', sublabel: 'Reservas e hospedagem', href: '/hotel', icon: Building2, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao'] },
  { key: 'banho_tosa', label: 'Banho & Tosa', sublabel: 'Agendamentos de banho e tosa', href: '/banho-tosa', icon: Scissors, iconColor: 'text-brand-teal', iconBg: 'bg-teal-50', defaultRoles: ['admin', 'recepcao', 'banho_tosa'] },
  { key: 'pets', label: 'Pets', sublabel: 'Cadastro de pets', href: '/pets', icon: Dog, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao', 'banho_tosa'] },
  { key: 'tutores', label: 'Tutores', sublabel: 'Cadastro de tutores', href: '/tutores', icon: Users, iconColor: 'text-brand-orange', iconBg: 'bg-orange-50', defaultRoles: ['admin', 'recepcao'] },
  { key: 'financeiro', label: 'Financeiro', sublabel: 'Receitas, despesas e relatórios', href: '/financeiro', icon: DollarSign, iconColor: 'text-green-600', iconBg: 'bg-green-50', defaultRoles: ['admin', 'recepcao'] },
  // Menu "Mais": Alimentação em 1º (a pedido), depois em ordem alfabética
  // (Adaptação, Fornecedores, Funcionários, Tarefas, Transportes, Veterinário).
  // Início e Administração permanecem sempre por último.
  { key: 'alimentacao_medicacao', label: 'Alimentação', sublabel: 'Alimentação e medicação dos pets', href: '/alimentacao-medicacao', icon: UtensilsCrossed, iconColor: 'text-amber-500', iconBg: 'bg-amber-50', defaultRoles: ['admin', 'recepcao', 'banho_tosa'] },
  { key: 'adaptacao', label: 'Adaptação', sublabel: 'Agendamentos do primeiro dia na Play Dog', href: '/adaptacao', icon: PawPrint, iconColor: 'text-brand-teal', iconBg: 'bg-teal-50', defaultRoles: ['admin', 'recepcao'] },
  { key: 'fornecedores', label: 'Fornecedores', sublabel: 'Contatos e parceiros', href: '/fornecedores', icon: Truck, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao'] },
  { key: 'funcionarios', label: 'Funcionários', sublabel: 'Equipe, uniformes e comissões', href: '/funcionarios', icon: Briefcase, iconColor: 'text-brand-orange', iconBg: 'bg-orange-50', defaultRoles: ['admin'] },
  { key: 'tarefas', label: 'Tarefas do Dia', sublabel: 'Checklist da equipe e suas tarefas', href: '/tarefas', icon: ListTodo, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao', 'banho_tosa', 'motorista'] },
  { key: 'transportes', label: 'Transportes', sublabel: 'Corridas de hoje e agenda do motorista', href: '/transportes', icon: Car, iconColor: 'text-brand-orange', iconBg: 'bg-orange-100', defaultRoles: ['admin', 'recepcao', 'motorista'] },
  { key: 'veterinario', label: 'Veterinário', sublabel: 'Agendamentos de atendimento veterinário', href: '/veterinario', icon: Stethoscope, iconColor: 'text-rose-500', iconBg: 'bg-rose-50', defaultRoles: ['admin', 'recepcao'] },
  { key: 'dashboard', label: 'Início', sublabel: 'Painel geral do sistema', href: '/dashboard', icon: Home, iconColor: 'text-brand-purple', iconBg: 'bg-purple-100', defaultRoles: ['admin', 'recepcao', 'banho_tosa'] },
  { key: 'admin', label: 'Administração', sublabel: 'Usuários e configurações', href: '/admin', icon: Settings, iconColor: 'text-gray-600', iconBg: 'bg-gray-100', defaultRoles: ['admin'] },
]

/** Menus padrão (modelo) para um perfil — usado como ponto de partida do checklist. */
export function menusPadraoRole(role: UserRole): string[] {
  return MENUS.filter(m => m.defaultRoles.includes(role)).map(m => m.key)
}

/** Lista de menus que uma pessoa enxerga: usa a lista personalizada se houver; senão, o padrão do perfil. */
export function menusVisiveis(role: UserRole, menus?: string[] | null): MenuItem[] {
  if (menus && menus.length) return MENUS.filter(m => menus.includes(m.key))
  return MENUS.filter(m => m.defaultRoles.includes(role))
}
