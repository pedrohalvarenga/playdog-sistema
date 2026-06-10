'use client'

import { formatCurrency } from '@/lib/financeiro'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface MensalData {
  label: string   // 'Jan', 'Fev' …
  receitas: number
  despesas: number
}

interface FatiaData {
  label: string
  valor: number
  cor: string
}

interface DashboardChartsProps {
  historico: MensalData[]
  receitasPorArea: FatiaData[]
  despesasPorArea: FatiaData[]
}

// ── Bar Chart: entradas × saídas ──────────────────────────────────────────
function BarChart({ data }: { data: MensalData[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.receitas, d.despesas]), 1)
  const W = 320
  const H = 110
  const padB = 22
  const barW = Math.floor((W / data.length) * 0.35)
  const gap = 2
  const slotW = W / data.length

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {/* Grade horizontal */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = (H - padB) * (1 - f)
          return <line key={f} x1={0} y1={y} x2={W} y2={y} stroke="#f3f4f6" strokeWidth="1" />
        })}

        {data.map((d, i) => {
          const cx = slotW * i + slotW / 2
          const hR = ((H - padB) * d.receitas) / maxVal
          const hD = ((H - padB) * d.despesas) / maxVal
          return (
            <g key={i}>
              <rect x={cx - barW - gap / 2} y={H - padB - hR} width={barW} height={hR} fill="#22c55e" rx="2" opacity="0.85" />
              <rect x={cx + gap / 2} y={H - padB - hD} width={barW} height={hD} fill="#f87171" rx="2" opacity="0.85" />
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{d.label}</text>
            </g>
          )
        })}

        {/* Eixo X */}
        <line x1={0} y1={H - padB} x2={W} y2={H - padB} stroke="#e5e7eb" strokeWidth="1" />
      </svg>

      {/* Legenda */}
      <div className="flex justify-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Entradas
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Saídas
        </span>
      </div>
    </div>
  )
}

// ── Pie Chart ─────────────────────────────────────────────────────────────
function PieChart({ data, titulo }: { data: FatiaData[]; titulo: string }) {
  const total = data.reduce((s, d) => s + d.valor, 0)
  if (total === 0) return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-semibold text-gray-500">{titulo}</p>
      <p className="text-xs text-gray-400">Sem dados</p>
    </div>
  )

  const R = 44
  const cx = 54
  const cy = 54
  let angle = -90

  function arc(start: number, end: number) {
    const toRad = (a: number) => (a * Math.PI) / 180
    const x1 = cx + R * Math.cos(toRad(start))
    const y1 = cy + R * Math.sin(toRad(start))
    const x2 = cx + R * Math.cos(toRad(end))
    const y2 = cy + R * Math.sin(toRad(end))
    const large = end - start > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
  }

  const slices = data.map(d => {
    const deg = (d.valor / total) * 360
    const path = arc(angle, angle + deg - 0.5)
    angle += deg
    return { ...d, path, pct: Math.round((d.valor / total) * 100) }
  })

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-600">{titulo}</p>
      <svg viewBox="0 0 108 108" className="w-24 h-24">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.cor} stroke="white" strokeWidth="1.5" />
        ))}
        <circle cx={cx} cy={cy} r={20} fill="white" />
      </svg>
      <div className="flex flex-col gap-1 w-full">
        {slices.filter(s => s.pct > 0).map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.cor }} />
            <span className="text-[10px] text-gray-600 flex-1 truncate">{s.label}</span>
            <span className="text-[10px] font-semibold text-gray-700">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal exportado ────────────────────────────────────────
export default function DashboardCharts({ historico, receitasPorArea, despesasPorArea }: DashboardChartsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Gráfico de barras */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Entradas × Saídas — 12 meses
        </p>
        <BarChart data={historico} />
      </div>

      {/* Pizza receita + despesa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
          <PieChart data={receitasPorArea} titulo="Receita por área" />
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
          <PieChart data={despesasPorArea} titulo="Despesa por área" />
        </div>
      </div>
    </div>
  )
}
