'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GlobalSearch from './GlobalSearch'

interface TopBarProps {
  titulo?: string
  nome?: string
}

export default function TopBar({ titulo, nome }: TopBarProps) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50 safe-top">
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/logo-playdog.png" alt="Play Dog" width={36} height={36} className="rounded-xl" />
          <div>
            <p className="font-bold text-sm text-gray-900 leading-tight">{titulo || 'Play Dog'}</p>
            {nome && <p className="text-xs text-gray-400">{nome}</p>}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          {confirmando ? (
            <div className="flex items-center gap-1.5">
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold">Sair</button>
              <button onClick={() => setConfirmando(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
              aria-label="Sair da conta"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
