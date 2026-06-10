'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    // Aceita e-mail ou primeiro nome: sem "@", resolve o nome para o e-mail
    let email = usuario.trim()
    if (!email.includes('@')) {
      const res = await fetch('/api/auth/email-por-nome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(res.status === 409 ? json.error : 'Nome ou senha incorretos.')
        setLoading(false)
        return
      }
      email = json.email
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('Nome, e-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-3xl bg-white shadow-lg flex items-center justify-center mb-4">
            <Image src="/logo-playdog.png" alt="Play Dog" width={72} height={72} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Play Dog</h1>
          <p className="text-gray-500 text-sm">Creche & Hotel Canino</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            id="usuario"
            label="Nome ou e-mail"
            type="text"
            placeholder="Ex.: daniel ou seu@email.com"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <Input
            id="senha"
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm text-center">
              {erro}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="mt-2">
            Entrar
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Acesso restrito a funcionários.<br />
          Fale com o administrador para obter acesso.
        </p>
      </div>
    </div>
  )
}
