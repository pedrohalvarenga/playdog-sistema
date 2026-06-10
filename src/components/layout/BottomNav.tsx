'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck, Building2, Scissors, Dog, Users, DollarSign,
  Home, Settings, Car, Menu, X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { type UserRole } from '@/types'
import { useState } from 'react'

// ── Barra de acesso rápido ──────────────────────────────────
interface QuickItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const quickItems: QuickItem[] = [
  { href: '/creche',     label: 'Chamada',    icon: CalendarCheck, roles: ['admin', 'recepcao'] },
  { href: '/hotel',      label: 'Hotel',      icon: Building2,     roles: ['admin', 'recepcao'] },
  { href: '/banho-tosa',   label: 'Banho',      icon: Scissors, roles: ['admin', 'recepcao', 'banho_tosa'] },
  { href: '/transportes',  label: 'Corridas',   icon: Car,      roles: ['motorista'] },
  { href: '/pets',         label: 'Pets',       icon: Dog,      roles: ['admin', 'recepcao', 'banho_tosa'] },
  { href: '/tutores',    label: 'Tutores',    icon: Users,         roles: ['admin', 'recepcao'] },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign,    roles: ['admin', 'recepcao'] },
]

// ── Menu "Mais" ─────────────────────────────────────────────
interface MoreItem {
  href: string
  label: string
  sublabel: string
  icon: React.ElementType
  roles: UserRole[]
  iconColor: string
  iconBg: string
}

const moreItems: MoreItem[] = [
  {
    href: '/dashboard',
    label: 'Início',
    sublabel: 'Painel geral do sistema',
    icon: Home,
    roles: ['admin', 'recepcao', 'banho_tosa'],
    iconColor: 'text-brand-purple',
    iconBg: 'bg-purple-100',
  },
  {
    href: '/admin',
    label: 'Administração',
    sublabel: 'Usuários e configurações',
    icon: Settings,
    roles: ['admin'],
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
  },
  {
    href: '/transportes',
    label: 'Transportes',
    sublabel: 'Corridas de hoje e agenda do motorista',
    icon: Car,
    roles: ['admin', 'recepcao', 'motorista'],
    iconColor: 'text-brand-orange',
    iconBg: 'bg-orange-100',
  },
]

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const visibleQuick = quickItems.filter(i => i.roles.includes(role))
  const visibleMore  = moreItems.filter(i => i.roles.includes(role))

  return (
    <>
      {/* ── Barra inferior ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-40">
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {visibleQuick.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 flex-1 min-w-0 transition-colors',
                  active ? 'text-brand-purple' : 'text-gray-400'
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span className={cn(
                  'text-[9px] font-medium leading-none truncate w-full text-center px-0.5',
                  active ? 'text-brand-purple' : 'text-gray-400'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Botão Mais */}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-2.5 flex-1 min-w-0 transition-colors',
              open ? 'text-brand-purple' : 'text-gray-400'
            )}
          >
            <Menu size={21} strokeWidth={open ? 2.5 : 2} />
            <span className="text-[9px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      {/* ── Bottom sheet ───────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Painel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
            <div className="bg-white rounded-t-3xl shadow-2xl">
              {/* Alça */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Cabeçalho */}
              <div className="flex items-center justify-between px-5 pt-1 pb-3">
                <p className="font-bold text-gray-900">Mais opções</p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Itens */}
              <div className="px-4 pb-10 flex flex-col gap-2">
                {visibleMore.map(item => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors active:scale-[.98]',
                        active
                          ? 'bg-purple-50 border border-purple-100'
                          : 'bg-gray-50 active:bg-gray-100'
                      )}
                    >
                      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', item.iconBg)}>
                        <Icon size={22} className={item.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-semibold text-sm', active ? 'text-brand-purple' : 'text-gray-900')}>
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sublabel}</p>
                      </div>
                      {active && <span className="w-2 h-2 rounded-full bg-brand-purple flex-shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
