'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

export default function HotelConfigPage() {
  const [capacidade, setCapacidade] = useState('')
  const [emails, setEmails] = useState('')
  const [horaRelatorio, setHoraRelatorio] = useState('08:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    createClient()
      .from('config_hotel')
      .select('chave, valor')
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map(r => [r.chave, r.valor]))
          setCapacidade(map['capacidade_max'] ?? '10')
          setEmails(map['emails_relatorio'] ?? '')
          setHoraRelatorio(map['hora_relatorio'] ?? '08:00')
        }
        setLoading(false)
      })
  }, [])

  async function salvar() {
    setSaving(true)
    const supabase = createClient()
    await Promise.all([
      supabase.from('config_hotel').upsert({ chave: 'capacidade_max', valor: capacidade }),
      supabase.from('config_hotel').upsert({ chave: 'emails_relatorio', valor: emails }),
      supabase.from('config_hotel').upsert({ chave: 'hora_relatorio', valor: horaRelatorio }),
    ])
    setSaving(false)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/hotel" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Configurações do Hotel</h1>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Capacidade máxima (cães por noite)
        </label>
        <input
          type="number"
          min="1"
          value={capacidade}
          onChange={e => setCapacidade(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
        <p className="text-xs text-gray-400 mt-1">
          Usado para colorir o calendário: verde (livre), amarelo (≥70%), vermelho (100%)
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          E-mails para relatório diário
        </label>
        <textarea
          rows={3}
          value={emails}
          onChange={e => setEmails(e.target.value)}
          placeholder="email1@exemplo.com, email2@exemplo.com"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Separe múltiplos e-mails com vírgula</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Horário do relatório automático
        </label>
        <input
          type="time"
          value={horaRelatorio}
          onChange={e => setHoraRelatorio(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
        <p className="text-xs text-gray-400 mt-1">
          O cron roda todos os dias às 8h (configure no Vercel: "0 11 * * *" = 11h UTC = 8h BRT)
        </p>
      </div>

      <Button variant="primary" size="lg" loading={saving} onClick={salvar}>
        {ok ? '✓ Salvo!' : <><Save size={18} /> Salvar configurações</>}
      </Button>

      <div className="mt-4">
        <Link href="/hotel/relatorio" className="text-brand-purple text-sm font-semibold">
          → Ver / enviar relatório diário agora
        </Link>
      </div>
    </div>
  )
}
