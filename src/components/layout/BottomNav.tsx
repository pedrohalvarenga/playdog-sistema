'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dog, Users, CalendarCheck, Settings, DollarSign, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard',   label: 'Início',      icon: Home,        roles: ['admin', 'recepcao', 'banho_tosa', 'motorista'] },
  { href: '/creche',      label: 'Chamada',     icon: CalendarCheck, roles: ['admin', 'recepcao'] },
  { href: '/hotel',       label: 'Hotel',       icon: Moon,        roles: ['admin', 'recepcao', 'motorista'] },
  { href: '/pets',        label: 'Pets',        icon: Dog,         roles: ['admin', 'recepcao', 'banho_tosa'] },
  { href: '/financeiro',  label: 'Financeiro',  icon: DollarSign,  roles: ['admin', 'recepcao'] },
  { href: '/tutores',     label: 'Tutores',     icon: Users,       roles: ['admin', 'recepcao'] },
  { href: '/admin',       label: 'Admin',       icon: Settings,    roles: ['admin'] },
]

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const allowed = navItems.filter((item) => item.roles.includes(role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {allowed.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-3 px-4 min-w-[60px] transition-colors',
                active ? 'text-brand-purple' : 'text-gray-400'
              )}
            >
              <Icon size={24} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
