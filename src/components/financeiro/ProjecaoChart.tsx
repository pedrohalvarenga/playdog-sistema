'use client'

import { formatCurrency } from '@/lib/financeiro'

interface ProjecaoMesData {
  nome_mes: string
  saldo_projetado: number
  receitas_previstas: number
  despesas_previstas: number
  alerta: boolean
}

export default function ProjecaoChart({
  dados,
  caixaMinimo,
}: {
  dados: ProjecaoMesData[]
  caixaMinimo: number
}) {
  if (dados.length === 0) return null

  const W = 340
  const H = 140
  const padL = 4
  const padR = 4
  const padT = 16
  const padB = 28

  const valores = dados.map(d => d.saldo_projetado)
  const minV = Math.min(...valores, caixaMinimo, 0)
  const maxV = Math.max(...valores, caixaMinimo) * 1.05 || 1

  const scaleX = (i: number) =>
    padL + (i / (dados.length - 1)) * (W - padL - padR)
  const scaleY = (v: number) =>
    padT + ((maxV - v) / (maxV - minV)) * (H - padT - padB)

  const points = dados.map((d, i) => ({ x: scaleX(i), y: scaleY(d.saldo_projetado) }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(H - padB).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - padB).toFixed(1)} Z`

  const yMin = scaleY(caixaMinimo)
  const yZero = scaleY(0)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradAlerta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Faixa de alerta (abaixo do mínimo) */}
        {yMin < H - padB && (
          <rect
            x={padL} y={yMin}
            width={W - padL - padR}
            height={H - padB - yMin}
            fill="#fee2e2"
            opacity="0.5"
          />
        )}

        {/* Faixa negativa */}
        {yZero < H - padB && (
          <rect
            x={padL} y={yZero}
            width={W - padL - padR}
            height={H - padB - yZero}
            fill="#fca5a5"
            opacity="0.4"
          />
        )}

        {/* Linha zero */}
        {minV < 0 && (
          <line x1={padL} y1={yZero} x2={W - padR} y2={yZero}
            stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,3" />
        )}

        {/* Linha caixa mínimo */}
        <line x1={padL} y1={yMin} x2={W - padR} y2={yMin}
          stroke="#f97316" strokeWidth="0.8" strokeDasharray="4,3" />
        <text x={W - padR - 2} y={yMin - 2} textAnchor="end" fontSize="7" fill="#f97316">
          mín. {formatCurrency(caixaMinimo)}
        </text>

        {/* Área preenchida */}
        <path d={areaPath} fill="url(#gradOk)" />

        {/* Linha principal */}
        <path d={linePath} fill="none" stroke="#8A05BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y} r="3"
            fill={dados[i].alerta ? '#ef4444' : '#8A05BE'}
            stroke="white" strokeWidth="1.5"
          />
        ))}

        {/* Eixo X — labels dos meses */}
        {dados.map((d, i) => {
          // Mostra apenas a cada 2 meses para não sobrepor
          if (i % 2 !== 0 && i !== dados.length - 1) return null
          return (
            <text key={i} x={scaleX(i)} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#9ca3af">
              {d.nome_mes}
            </text>
          )
        })}
      </svg>

      {/* Tooltips estilo lista abaixo */}
      <div className="flex flex-col gap-1 mt-3">
        {dados.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              d.alerta ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
            }`}
          >
            {d.alerta && <span className="text-red-500 font-bold">!</span>}
            <span className="font-semibold text-gray-600 w-10 flex-shrink-0">{d.nome_mes}</span>
            <span className="text-green-600 flex-1">+{formatCurrency(d.receitas_previstas)}</span>
            <span className="text-red-500 flex-1">−{formatCurrency(d.despesas_previstas)}</span>
            <span className={`font-bold flex-shrink-0 ${d.saldo_projetado < 0 ? 'text-red-600' : d.alerta ? 'text-orange-500' : 'text-gray-800'}`}>
              {formatCurrency(d.saldo_projetado)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
