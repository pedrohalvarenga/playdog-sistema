'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/lib/financeiro'

interface OfxTransaction {
  id: string
  tipo: 'CREDIT' | 'DEBIT'
  valor: number
  data: string
  memo: string
  status: 'novo' | 'existente' | 'ignorar'
}

function parseOfx(content: string): OfxTransaction[] {
  const txns: OfxTransaction[] = []
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    const bloco = match[1]
    const get = (tag: string) => {
      const m = bloco.match(new RegExp(`<${tag}[^>]*>([^<\r\n]+)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const tipo = get('TRNTYPE') as 'CREDIT' | 'DEBIT'
    const valorStr = get('TRNAMT').replace(',', '.')
    const valor = Math.abs(parseFloat(valorStr))
    const dtRaw = get('DTPOSTED').replace(/\D/g, '').slice(0, 8)
    const data = dtRaw ? `${dtRaw.slice(0,4)}-${dtRaw.slice(4,6)}-${dtRaw.slice(6,8)}` : ''
    const memo = get('MEMO') || get('NAME') || ''
    const fitid = get('FITID')
    if (valor > 0 && data) {
      txns.push({ id: fitid || `${data}-${valor}`, tipo, valor, data, memo, status: 'novo' })
    }
  }
  return txns
}

export default function ConciliacaoPage() {
  const router = useRouter()
  const [txns, setTxns] = useState<OfxTransaction[]>([])
  const [importando, setImportando] = useState(false)
  const [done, setDone] = useState(false)
  const [contaId, setContaId] = useState('')
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseOfx(text)

    // Busca contas se ainda não carregou
    if (!loaded) {
      const supabase = createClient()
      const { data } = await supabase.from('contas_financeiras').select('id, nome').eq('ativo', true)
      if (data) { setContas(data); setContaId(data[0]?.id ?? '') }
      setLoaded(true)
    }

    setTxns(parsed)
  }

  function toggleStatus(id: string, next: OfxTransaction['status']) {
    setTxns(prev => prev.map(t => t.id === id ? { ...t, status: next } : t))
  }

  async function importar() {
    const novos = txns.filter(t => t.status === 'novo')
    if (novos.length === 0) return
    setImportando(true)
    const supabase = createClient()

    const inserts = novos.map(t => ({
      data: t.data,
      valor: t.valor,
      area: 'geral' as const,
      categoria: t.tipo === 'CREDIT' ? 'outros' as const : undefined,
      conta_id: contaId,
      descricao: t.memo,
      status: 'pago' as const,
    }))

    const receitasInsert = inserts.filter(i => {
      const txn = novos.find(t => t.data === i.data && t.valor === i.valor && t.tipo === 'CREDIT')
      return !!txn
    })
    const despesasInsert = inserts.filter(i => {
      const txn = novos.find(t => t.data === i.data && t.valor === i.valor && t.tipo === 'DEBIT')
      return !!txn
    })

    if (receitasInsert.length > 0) {
      await supabase.from('receitas').insert(
        receitasInsert.map(r => ({
          data: r.data, valor: r.valor, area: r.area,
          categoria: 'outros' as const, forma_pagamento: 'pix' as const,
          conta_id: r.conta_id, descricao: r.descricao, status: 'pago' as const,
        }))
      )
    }
    if (despesasInsert.length > 0) {
      await supabase.from('despesas').insert(
        despesasInsert.map(d => ({
          data: d.data, valor: d.valor, area: d.area,
          categoria: 'outros' as const,
          conta_id: d.conta_id, descricao: d.descricao, status: 'pago' as const,
        }))
      )
    }

    setImportando(false)
    setDone(true)
  }

  const novos = txns.filter(t => t.status === 'novo')
  const ignorados = txns.filter(t => t.status === 'ignorar')

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Conciliação OFX</h1>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 size={56} className="text-green-500" />
          <p className="font-bold text-xl text-gray-900">{novos.length} lançamentos importados</p>
          <Button onClick={() => router.push('/financeiro')}>Voltar ao financeiro</Button>
        </div>
      ) : (
        <>
          {/* Upload */}
          <label className="flex flex-col items-center gap-3 py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-brand-purple hover:bg-purple-50 transition-colors">
            <Upload size={32} className="text-gray-400" />
            <div className="text-center">
              <p className="font-semibold text-gray-700">Selecionar arquivo OFX</p>
              <p className="text-xs text-gray-400 mt-1">Exporte o extrato do C6 ou PagBank no formato OFX</p>
            </div>
            <input type="file" accept=".ofx,.OFX" onChange={handleFile} className="hidden" />
          </label>

          {/* Seleção de conta */}
          {txns.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Conta do extrato</label>
              <select value={contaId} onChange={e => setContaId(e.target.value)}
                className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          {/* Transações */}
          {txns.length > 0 && (
            <>
              <p className="text-sm text-gray-500">
                {txns.length} transações encontradas · {novos.length} para importar · {ignorados.length} ignoradas
              </p>
              <div className="flex flex-col gap-2">
                {txns.map(t => (
                  <Card key={t.id} className={`flex items-center gap-3 ${
                    t.status === 'ignorar' ? 'opacity-40' : ''
                  }`}>
                    <div className={`w-2 h-10 rounded-full flex-shrink-0 ${t.tipo === 'CREDIT' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.memo || '—'}</p>
                      <p className="text-xs text-gray-400">
                        {t.data ? new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                        {' · '}
                        {t.tipo === 'CREDIT' ? 'Crédito' : 'Débito'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className={`font-bold text-sm ${t.tipo === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipo === 'CREDIT' ? '+' : '−'}{formatCurrency(t.valor)}
                      </p>
                      <div className="flex gap-1">
                        <button onClick={() => toggleStatus(t.id, t.status === 'novo' ? 'ignorar' : 'novo')}
                          className={`p-1 rounded-lg transition-colors ${t.status === 'ignorar' ? 'text-gray-300' : 'text-green-500 hover:text-green-700'}`}>
                          {t.status === 'ignorar' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {novos.length > 0 && (
                <Button size="lg" onClick={importar} loading={importando}>
                  Importar {novos.length} lançamento{novos.length !== 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}

          {txns.length === 0 && (
            <Card className="flex items-center gap-3 bg-blue-50 border-blue-200">
              <HelpCircle size={20} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Como exportar o extrato OFX?</p>
                <p className="text-xs text-blue-600 mt-0.5">PagBank: Extrato → Exportar → OFX</p>
                <p className="text-xs text-blue-600">C6 Bank: Extrato → Baixar → Formato OFX</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
