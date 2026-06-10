'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'

export default function ConfigCrechePage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const [capacidade, setCapacidade] = useState('20')
  const [envioAuto, setEnvioAuto] = useState(false)
  const [diaEnvio, setDiaEnvio] = useState('1')

  const [precoDiaria, setPrecoDiaria] = useState('')
  const [precoSemanal, setPrecoSemanal] = useState('')
  const [precoMensal, setPrecoMensal] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: config }, { data: precos }] = await Promise.all([
        supabase.from('config_creche').select('*'),
        supabase.from('precos_padrao').select('*'),
      ])
      config?.forEach(c => {
        if (c.chave === 'capacidade_diaria') setCapacidade(c.valor)
        if (c.chave === 'envio_extrato_automatico') setEnvioAuto(c.valor === 'true')
        if (c.chave === 'dia_envio_extrato') setDiaEnvio(c.valor)
      })
      precos?.forEach(p => {
        if (p.plano === 'diaria_avulsa') setPrecoDiaria(String(p.valor))
        if (p.plano === 'pacote_semanal') setPrecoSemanal(String(p.valor))
        if (p.plano === 'pacote_mensal') setPrecoMensal(String(p.valor))
      })
      setLoading(false)
    }
    load()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const supabase = createClient()

    await Promise.all([
      supabase.from('config_creche').upsert({ chave: 'capacidade_diaria', valor: capacidade }),
      supabase.from('config_creche').upsert({ chave: 'envio_extrato_automatico', valor: envioAuto ? 'true' : 'false' }),
      supabase.from('config_creche').upsert({ chave: 'dia_envio_extrato', valor: diaEnvio }),
      supabase.from('precos_padrao').upsert({ plano: 'diaria_avulsa', valor: parseFloat(precoDiaria) || 0 }),
      supabase.from('precos_padrao').upsert({ plano: 'pacote_semanal', valor: parseFloat(precoSemanal) || 0 }),
      supabase.from('precos_padrao').upsert({ plano: 'pacote_mensal', valor: parseFloat(precoMensal) || 0 }),
    ])

    setSalvando(false)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
  }

  if (loadingProfile || loading) {
    return <div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" /></div>
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-3">
        <AlertCircle size={40} className="text-red-400" />
        <p className="font-semibold text-gray-700">Acesso restrito ao administrador</p>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Configurações da Creche</h1>
      </div>

      {sucesso && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <Save size={16} /> Configurações salvas!
        </div>
      )}

      <form onSubmit={salvar} className="flex flex-col gap-4">
        {/* Capacidade */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Capacidade</h2>
          <Input
            label="Máximo de cães por dia"
            type="number"
            min="1"
            value={capacidade}
            onChange={e => setCapacidade(e.target.value)}
          />
        </section>

        {/* Preços padrão */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Preços Padrão (R$)</h2>
          <p className="text-xs text-gray-400 -mt-2">Usados no extrato e painel de cobrança. Tutores com preço negociado sobrepõem este valor.</p>
          <Input label="Diária avulsa" type="text" inputMode="decimal" placeholder="0,00" value={precoDiaria} onChange={e => setPrecoDiaria(e.target.value)} />
          <Input label="Pacote semanal (por diária)" type="text" inputMode="decimal" placeholder="0,00" value={precoSemanal} onChange={e => setPrecoSemanal(e.target.value)} />
          <Input label="Pacote mensal (por diária)" type="text" inputMode="decimal" placeholder="0,00" value={precoMensal} onChange={e => setPrecoMensal(e.target.value)} />
        </section>

        {/* Envio de extrato */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Envio Automático de Extrato</h2>

          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
            <label className="font-semibold text-gray-700">Envio automático ativo</label>
            <button
              type="button"
              onClick={() => setEnvioAuto(!envioAuto)}
              className={`w-12 h-7 rounded-full transition-all ${envioAuto ? 'bg-brand-purple' : 'bg-gray-300'} relative`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${envioAuto ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {envioAuto && (
            <Input
              label="Dia do mês para envio"
              type="number"
              min="1"
              max="28"
              value={diaEnvio}
              onChange={e => setDiaEnvio(e.target.value)}
            />
          )}
          <p className="text-xs text-gray-400">
            Quando ativo, envia automaticamente o extrato do mês anterior para todos os tutores com e-mail cadastrado.
            Configure RESEND_API_KEY e RESEND_FROM no Vercel.
          </p>
        </section>

        <Button type="submit" size="lg" loading={salvando}>
          Salvar Configurações
        </Button>
      </form>
    </div>
  )
}
