'use client'

import { useState } from 'react'
import { ArrowLeft, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface ResultadoEnvio {
  tutor: string
  email: string
  status: 'ok' | 'erro'
  erro?: string
}

export default function EnvioLotePage() {
  const { profile, loading: loadingProfile } = useProfile()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() === 0 ? 12 : hoje.getMonth())
  const [ano, setAno] = useState(hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear())
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([])
  const [concluido, setConcluido] = useState(false)

  async function enviarLote() {
    if (!confirm(`Enviar extrato de ${MESES[mes]}/${ano} para todos os tutores com e-mail cadastrado?`)) return

    setEnviando(true)
    setConcluido(false)
    setResultados([])

    const res = await fetch('/api/email/enviar-extrato-lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano }),
    })

    const data = await res.json()
    setResultados(data.resultados ?? [])
    setConcluido(true)
    setEnviando(false)
  }

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]

  if (loadingProfile) return <div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" /></div>

  if (profile?.role !== 'admin') {
    return (
      <div className="py-20 text-center">
        <p className="font-semibold text-gray-700">Acesso restrito ao administrador</p>
        <Link href="/creche" className="text-brand-purple text-sm font-semibold mt-2 inline-block">← Voltar</Link>
      </div>
    )
  }

  const enviados = resultados.filter(r => r.status === 'ok').length
  const erros = resultados.filter(r => r.status === 'erro').length

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/creche" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Envio em Lote</h1>
          <p className="text-sm text-gray-400">Extrato para todos os tutores</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Envia o extrato do mês selecionado para <strong>todos os tutores</strong> que têm e-mail cadastrado e tiveram movimentação no período.
        </p>

        <div className="flex gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="flex-1 px-3 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          >
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="px-3 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <Button onClick={enviarLote} loading={enviando} size="lg">
          <Send size={18} /> Enviar para Todos
        </Button>
      </div>

      {enviando && (
        <div className="flex items-center justify-center gap-3 py-8 text-brand-purple">
          <Loader2 size={24} className="animate-spin" />
          <p className="font-semibold">Enviando e-mails...</p>
        </div>
      )}

      {concluido && (
        <>
          <div className="flex gap-3">
            <div className="flex-1 bg-green-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{enviados}</p>
              <p className="text-xs text-green-500">Enviados</p>
            </div>
            {erros > 0 && (
              <div className="flex-1 bg-red-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{erros}</p>
                <p className="text-xs text-red-500">Com erro</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {resultados.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${r.status === 'ok' ? 'bg-green-50' : 'bg-red-50'}`}>
                {r.status === 'ok'
                  ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  : <XCircle size={18} className="text-red-500 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{r.tutor}</p>
                  <p className="text-xs text-gray-400 truncate">{r.email}</p>
                  {r.erro && <p className="text-xs text-red-500">{r.erro}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
