'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Fuel, Wrench, Plus,
  Gauge, DollarSign, Droplets, Settings, Check, X,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { formatKm } from '@/lib/transporte'
import type { Rota, Abastecimento, ManutencaoVeiculo } from '@/types/transporte'
import { useProfile } from '@/hooks/useProfile'
import { hojeLocal } from '@/lib/datas'

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMoney(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function VeiculoPage() {
  const { profile } = useProfile()
  const [mes, setMes] = useState(mesAtual())
  const [rotas, setRotas] = useState<Rota[]>([])
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [manutencoes, setManutencoes] = useState<ManutencaoVeiculo[]>([])
  const [loading, setLoading] = useState(true)

  // Modal manutenção
  const [modalManut, setModalManut] = useState(false)
  const [mData, setMData] = useState(hojeLocal())
  const [mDesc, setMDesc] = useState('')
  const [mValor, setMValor] = useState('')
  const [mKm, setMKm] = useState('')
  const [salvandoManut, setSalvandoManut] = useState(false)
  const [erroManut, setErroManut] = useState('')

  // Config (admin)
  const [editConfig, setEditConfig] = useState(false)
  const [enderecoPartida, setEnderecoPartida] = useState('')
  const [valorMotorista, setValorMotorista] = useState('')
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const inicio = `${mes}-01`
  const fimDate = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0)
  const fim = `${mes}-${String(fimDate.getDate()).padStart(2, '0')}`

  const carregar = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: rs }, { data: abs }, { data: ms }, { data: cfg }] = await Promise.all([
      supabase.from('rotas').select('*').eq('status', 'finalizada').gte('data', inicio).lte('data', fim),
      supabase.from('abastecimentos').select('*').gte('data', inicio + 'T00:00:00').lte('data', fim + 'T23:59:59').order('data', { ascending: false }),
      supabase.from('manutencoes_veiculo').select('*').gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
      supabase.from('config_transporte').select('*'),
    ])
    setRotas((rs as Rota[]) ?? [])
    setAbastecimentos((abs as Abastecimento[]) ?? [])
    setManutencoes((ms as ManutencaoVeiculo[]) ?? [])
    const mapa = new Map((cfg ?? []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
    setEnderecoPartida(mapa.get('endereco_partida') ?? '')
    setValorMotorista(mapa.get('pagamento_motorista_valor') ?? '350')
    setLoading(false)
  }, [inicio, fim])

  useEffect(() => { carregar() }, [carregar])

  function navMes(delta: number) {
    const d = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)) - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function salvarManutencao() {
    setErroManut('')
    const res = await fetch('/api/transporte/manutencao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mData, descricao: mDesc, valor: mValor, km: mKm }),
    })
    setSalvandoManut(true)
    const json = await res.json()
    setSalvandoManut(false)
    if (!res.ok) { setErroManut(json.error ?? 'Erro ao salvar.'); return }
    setModalManut(false)
    setMDesc(''); setMValor(''); setMKm('')
    await carregar()
  }

  async function salvarConfig() {
    setSalvandoConfig(true)
    const supabase = createClient()
    await Promise.all([
      supabase.from('config_transporte').update({ valor: enderecoPartida.trim(), updated_at: new Date().toISOString() }).eq('chave', 'endereco_partida'),
      supabase.from('config_transporte').update({ valor: valorMotorista.replace(',', '.').trim(), updated_at: new Date().toISOString() }).eq('chave', 'pagamento_motorista_valor'),
    ])
    setSalvandoConfig(false)
    setEditConfig(false)
  }

  // Estatísticas calculadas sozinhas
  const kmRodado = rotas.reduce((acc, r) =>
    acc + (r.km_inicial != null && r.km_final != null ? r.km_final - r.km_inicial : 0), 0)
  const gastoCombustivel = abastecimentos.reduce((acc, a) => acc + Number(a.valor_total), 0)
  const litros = abastecimentos.reduce((acc, a) => acc + Number(a.litros), 0)
  const gastoManutencao = manutencoes.reduce((acc, m) => acc + Number(m.valor), 0)
  const consumo = litros > 0 && kmRodado > 0 ? kmRodado / litros : null
  const custoPorKm = kmRodado > 0 ? (gastoCombustivel + gastoManutencao) / kmRodado : null

  const nomeMes = formatDate(mes + '-15T12:00:00', 'MMMM yyyy')

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/transportes" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Painel do Veículo</h1>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center justify-between">
        <button onClick={() => navMes(-1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <p className="font-bold text-gray-800 capitalize">{nomeMes}</p>
        <button onClick={() => navMes(1)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronRight size={22} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Estatísticas do mês */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <Gauge size={22} className="text-brand-purple mb-1" />
              <p className="text-2xl font-bold text-gray-900">{formatKm(kmRodado)}</p>
              <p className="text-xs text-gray-400">Km rodado no mês</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <Fuel size={22} className="text-brand-orange mb-1" />
              <p className="text-2xl font-bold text-gray-900">{fmtMoney(gastoCombustivel)}</p>
              <p className="text-xs text-gray-400">Combustível ({litros.toFixed(1).replace('.', ',')} L)</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <Droplets size={22} className="text-brand-teal mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {consumo != null ? `${consumo.toFixed(1).replace('.', ',')} km/L` : '—'}
              </p>
              <p className="text-xs text-gray-400">Consumo médio</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <DollarSign size={22} className="text-green-500 mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {custoPorKm != null ? fmtMoney(custoPorKm) : '—'}
              </p>
              <p className="text-xs text-gray-400">Custo por km</p>
            </div>
          </div>

          {/* Abastecimentos do mês */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              ⛽ Abastecimentos ({abastecimentos.length})
            </p>
            {abastecimentos.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum abastecimento neste mês.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {abastecimentos.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{fmtMoney(Number(a.valor_total))}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(a.data, "dd/MM 'às' HH:mm")} · {Number(a.litros).toFixed(2).replace('.', ',')} L · km {a.km_painel}
                      </p>
                    </div>
                    {a.cupom_url && (
                      <a href={a.cupom_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-teal font-semibold">cupom</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manutenções */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                🔧 Manutenções ({manutencoes.length})
              </p>
              <button onClick={() => setModalManut(true)}
                className="flex items-center gap-1 text-xs font-bold text-brand-purple">
                <Plus size={14} /> Registrar
              </button>
            </div>
            {manutencoes.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhuma manutenção neste mês.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {manutencoes.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900">{m.descricao}</p>
                      <p className="font-bold text-gray-900">{fmtMoney(Number(m.valor))}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(m.data + 'T12:00:00', 'dd/MM/yyyy')}{m.km != null && ` · km ${m.km}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configurações (admin) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Settings size={16} className="text-gray-400" /> Configurações
                </p>
                {!editConfig && (
                  <button onClick={() => setEditConfig(true)} className="text-xs font-bold text-brand-purple">Editar</button>
                )}
              </div>

              {editConfig ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                      Endereço de partida (Play Dog)
                    </label>
                    <input value={enderecoPartida} onChange={e => setEnderecoPartida(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                      Pagamento semanal do motorista (R$)
                    </label>
                    <input type="text" inputMode="decimal" value={valorMotorista}
                      onChange={e => setValorMotorista(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setEditConfig(false); carregar() }}
                      className="py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm">
                      Cancelar
                    </button>
                    <button onClick={salvarConfig} disabled={salvandoConfig}
                      className="py-2.5 rounded-xl bg-brand-purple text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                      <Check size={15} /> Salvar
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600 flex flex-col gap-1">
                  <p><span className="text-gray-400">Partida:</span> {enderecoPartida || '—'}</p>
                  <p><span className="text-gray-400">Motorista/semana:</span> {fmtMoney(parseFloat(valorMotorista) || 0)}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal manutenção */}
      {modalManut && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Wrench size={20} className="text-brand-purple" /> Registrar manutenção
              </h2>
              <button onClick={() => setModalManut(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data *</label>
              <input type="date" value={mData} onChange={e => setMData(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Descrição *</label>
              <input value={mDesc} onChange={e => setMDesc(e.target.value)}
                placeholder="Ex.: troca de óleo e filtro"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Valor (R$) *</label>
                <input type="text" inputMode="decimal" value={mValor} onChange={e => setMValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Km</label>
                <input type="text" inputMode="decimal" value={mKm} onChange={e => setMKm(e.target.value)}
                  placeholder="opcional"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm" />
              </div>
            </div>

            {erroManut && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erroManut}</p>}

            <button onClick={salvarManutencao} disabled={salvandoManut}
              className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50">
              {salvandoManut ? 'Salvando...' : 'Salvar manutenção'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
