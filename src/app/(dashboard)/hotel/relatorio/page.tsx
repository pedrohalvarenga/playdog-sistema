'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Hospedagem, EscalaPlantao } from '@/types/hotel'
import { hojeLocal, diaLocal } from '@/lib/datas'

export default function RelatorioPage() {
  const [data, setData] = useState(() => hojeLocal())
  const [entradas, setEntradas] = useState<Hospedagem[]>([])
  const [saidas, setSaidas] = useState<Hospedagem[]>([])
  const [hospedados, setHospedados] = useState<Hospedagem[]>([])
  const [escala, setEscala] = useState<EscalaPlantao | null>(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()

    Promise.all([
      supabase
        .from('hospedagens')
        .select('*, pet:pets(nome, porte, tutor:tutores(nome, telefone))')
        .not('status', 'in', '(cancelada)')
        .order('checkin_previsto'),
      supabase
        .from('escala_plantao')
        .select('*, plantonista:plantonistas(nome, telefone)')
        .eq('data', data)
        .single(),
    ]).then(([{ data: hosp }, { data: esc }]) => {
      const lista = (hosp as Hospedagem[]) ?? []
      const amanha = new Date(data)
      amanha.setDate(amanha.getDate() + 1)
      const amanhaDStr = diaLocal(amanha)

      const ent = lista.filter(h => {
        const ci = diaLocal(new Date(h.checkin_real ?? h.checkin_previsto))
        return ci === data
      })
      const sai = lista.filter(h => {
        const co = diaLocal(new Date(h.checkout_real ?? h.checkout_previsto))
        return co === data
      })
      const hosp2 = lista.filter(h => {
        const ci = diaLocal(new Date(h.checkin_previsto))
        const co = diaLocal(new Date(h.checkout_previsto))
        return ci <= data && co > data
      })

      setEntradas(ent)
      setSaidas(sai)
      setHospedados(hosp2)
      setEscala(esc as EscalaPlantao | null)
      setLoading(false)
    })
  }, [data])

  async function enviarEmail() {
    setEnviando(true)
    const res = await fetch('/api/hotel/relatorio-diario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    setEnviando(false)
    if (res.ok) {
      setEnviado(true)
      setTimeout(() => setEnviado(false), 3000)
    } else {
      alert('Erro ao enviar relatório. Verifique o e-mail configurado.')
    }
  }

  const totalSaidas = saidas.reduce((acc, h) => acc + (h.valor_total ?? 0), 0)
  const plantonista = escala?.plantonista as { nome?: string; telefone?: string } | undefined

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/hotel" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Relatório Diário</h1>
      </div>

      {/* Seletor de data */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data</label>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
        />
      </div>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-2xl py-3 font-semibold text-sm"
        >
          <Download size={18} /> Baixar PDF
        </button>
        <Button variant="primary" loading={enviando} onClick={enviarEmail}>
          {enviado ? '✓ Enviado!' : <><Send size={18} /> Enviar por e-mail</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      ) : (
        /* Conteúdo do relatório — imprimível */
        <div id="relatorio-print" className="bg-white rounded-3xl border border-gray-200 p-5 flex flex-col gap-4">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b-2 border-brand-purple pb-4">
            <div>
              <h2 className="text-2xl font-black text-brand-purple">PLAY DOG</h2>
              <p className="text-xs text-gray-400">Hotel Canino — Relatório Diário</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{formatDate(data + 'T12:00:00', "dd 'de' MMMM 'de' yyyy")}</p>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{entradas.length}</p>
              <p className="text-xs text-blue-400">Entradas</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-brand-purple">{hospedados.length}</p>
              <p className="text-xs text-purple-400">Hospedados</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-brand-orange">{saidas.length}</p>
              <p className="text-xs text-orange-400">Saídas</p>
            </div>
          </div>

          {/* Entradas */}
          {entradas.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Entradas do dia</h3>
              {entradas.map(h => {
                const p = h.pet as { nome: string; tutor: { nome: string } } | undefined
                return (
                  <div key={h.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-semibold text-gray-900">🐾 {p?.nome}</p>
                      <p className="text-xs text-gray-400">{p?.tutor?.nome}</p>
                    </div>
                    <p className="text-sm text-blue-600 font-semibold">
                      {new Date(h.checkin_real ?? h.checkin_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )
              })}
            </section>
          )}

          {/* Hospedados */}
          {hospedados.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Hospedados esta noite</h3>
              {hospedados.map(h => {
                const p = h.pet as { nome: string; tutor: { nome: string } } | undefined
                const saida = new Date(h.checkout_previsto)
                return (
                  <div key={h.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-semibold text-gray-900">🐾 {p?.nome}</p>
                      <p className="text-xs text-gray-400">{p?.tutor?.nome}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      saída {saida.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                )
              })}
            </section>
          )}

          {/* Saídas */}
          {saidas.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Saídas do dia</h3>
              {saidas.map(h => {
                const p = h.pet as { nome: string; tutor: { nome: string } } | undefined
                return (
                  <div key={h.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-semibold text-gray-900">🐾 {p?.nome}</p>
                      <p className="text-xs text-gray-400">{p?.tutor?.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-semibold">
                        {new Date(h.checkout_real ?? h.checkout_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {h.valor_total != null && h.valor_total > 0 && (
                        <p className="text-xs text-brand-purple font-bold">
                          R$ {h.valor_total.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {totalSaidas > 0 && (
                <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                  <p className="font-bold text-gray-900">Total recebido</p>
                  <p className="font-bold text-brand-purple">R$ {totalSaidas.toFixed(2).replace('.', ',')}</p>
                </div>
              )}
            </section>
          )}

          {/* Plantonista */}
          <section className="bg-indigo-50 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-2">Plantonista da noite</h3>
            {plantonista ? (
              <div>
                <p className="font-bold text-gray-900">{plantonista.nome}</p>
                {plantonista.telefone && <p className="text-xs text-gray-500">{plantonista.telefone}</p>}
              </div>
            ) : (
              <p className="text-red-500 font-semibold">⚠️ Nenhum plantonista escalado</p>
            )}
          </section>

          {/* Rodapé */}
          <div className="text-center text-xs text-gray-300 pt-2 border-t border-gray-100">
            Play Dog — Relatório gerado automaticamente
          </div>
        </div>
      )}
    </div>
  )
}
