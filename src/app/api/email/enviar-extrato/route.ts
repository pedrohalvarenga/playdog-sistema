import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { diaLocal } from '@/lib/datas'
import { montarContaCorrente, type MovimentoExtrato } from '@/lib/extrato'

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const FORMA_LABELS: Record<string, string> = {
  pix: 'Pix', pix_pagbank: 'Pix PagBank', pix_c6: 'Pix C6',
  dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito',
}

interface PetRow { id: string; nome: string; identificador?: string; saldo_diarias: number }
interface ReceitaRow { pet_id: string; data: string; valor: number; forma_pagamento: string; num_diarias: number; created_at?: string }
interface FreeCompraRow { pet_id: string; data: string; quantidade: number; forma_pagamento: string; created_at?: string }
interface PresencaRow { pet_id: string; data: string; created_at?: string }
interface AjusteRow { pet_id: string; quantidade: number; motivo: string; created_at: string }

export async function POST(request: Request) {
  const { tutor_id, mes, ano } = await request.json()
  if (!tutor_id || !mes || !ano) {
    return NextResponse.json({ error: 'tutor_id, mes e ano são obrigatórios' }, { status: 400 })
  }

  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const isInternal = request.headers.get('x-internal-secret') === process.env.CRON_SECRET
  if (!user && !isInternal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = diaLocal(new Date(ano, mes, 0))
  const fimExclusivo = diaLocal(new Date(ano, mes, 1))

  const [{ data: tutor }, { data: pets }] = await Promise.all([
    supabase.from('tutores').select('*').eq('id', tutor_id).single(),
    supabase.from('pets').select('id, nome, identificador, saldo_diarias').eq('tutor_id', tutor_id).eq('ativo', true),
  ])

  if (!tutor?.email) {
    return NextResponse.json({ error: 'Tutor não tem e-mail cadastrado' }, { status: 400 })
  }

  const petsList = (pets ?? []) as PetRow[]
  const petIds = petsList.map(p => p.id)

  const [{ data: receitas }, { data: comprasFree }, { data: presencas }, { data: ajustes }] = await Promise.all([
    supabase.from('receitas').select('pet_id, data, valor, forma_pagamento, num_diarias, created_at')
      .in('pet_id', petIds).eq('area', 'creche').eq('status', 'pago').not('num_diarias', 'is', null).gte('data', inicio).order('data'),
    supabase.from('compras_diarias').select('pet_id, data, quantidade, forma_pagamento, created_at')
      .in('pet_id', petIds).eq('valor_pago', 0).gte('data', inicio).order('data'),
    supabase.from('presencas').select('pet_id, data, created_at').in('pet_id', petIds).gte('data', inicio).order('data'),
    supabase.from('ajustes_saldo').select('pet_id, quantidade, motivo, created_at').in('pet_id', petIds).gte('created_at', inicio),
  ])

  const html = gerarHtmlExtrato({
    tutor: tutor as Record<string, string>,
    pets: petsList,
    receitas: (receitas ?? []) as ReceitaRow[],
    comprasFree: (comprasFree ?? []) as FreeCompraRow[],
    presencas: (presencas ?? []) as PresencaRow[],
    ajustes: (ajustes ?? []) as AjusteRow[],
    fim, fimExclusivo, mes, ano,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Play Dog <noreply@playdog.com.br>',
    to: [tutor.email],
    subject: `Extrato Play Dog — ${MESES[mes]}/${ano}`,
    html,
  })

  const status = emailError ? 'erro' : 'enviado'
  await supabase.from('envios_extrato').insert({
    tutor_id, mes, ano, status, erro: emailError ? JSON.stringify(emailError) : null,
  })

  if (emailError) {
    return NextResponse.json({ error: 'Erro ao enviar e-mail: ' + JSON.stringify(emailError) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function formatarData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtMoeda(v: number) {
  return 'R$ ' + v.toFixed(2).replace('.', ',')
}
function diariasLabel(s: number) {
  return `${s} diária${Math.abs(s) !== 1 ? 's' : ''}`
}
function corSaldo(s: number) {
  return s < 0 ? '#dc2626' : s > 0 ? '#16a34a' : '#6b7280'
}

function gerarHtmlExtrato({ tutor, pets, receitas, comprasFree, presencas, ajustes, fim, fimExclusivo, mes, ano }: {
  tutor: Record<string, string>
  pets: PetRow[]
  receitas: ReceitaRow[]
  comprasFree: FreeCompraRow[]
  presencas: PresencaRow[]
  ajustes: AjusteRow[]
  fim: string
  fimExclusivo: string
  mes: number
  ano: number
}) {
  let saldoTotal = 0
  let totalPresencas = 0
  let totalPago = 0
  const blocosPets: string[] = []

  for (const pet of pets) {
    const saldoLive = pet.saldo_diarias ?? 0
    const pR = receitas.filter(r => r.pet_id === pet.id)
    const pF = comprasFree.filter(c => c.pet_id === pet.id)
    const pP = presencas.filter(p => p.pet_id === pet.id)
    const pA = ajustes.filter(a => a.pet_id === pet.id)

    // Ancora o saldo anterior no saldo real (saldo_diarias)
    const creditosDesde = pR.reduce((s, r) => s + (r.num_diarias ?? 0), 0) + pF.reduce((s, c) => s + c.quantidade, 0)
    const netDesde = creditosDesde - pP.length + pA.reduce((s, a) => s + a.quantidade, 0)
    const saldoAnterior = saldoLive - netDesde

    const comprasMes = [
      ...pR.filter(r => r.data <= fim).map(r => ({
        data: r.data, quantidade: r.num_diarias ?? 0, valor_pago: r.valor,
        forma_pagamento: r.forma_pagamento, created_at: r.created_at,
      })),
      ...pF.filter(c => c.data <= fim).map(c => ({
        data: c.data, quantidade: c.quantidade, valor_pago: 0,
        forma_pagamento: c.forma_pagamento, created_at: c.created_at,
      })),
    ]
    const presencasMes = pP.filter(p => p.data <= fim)
    const ajustesMes = pA.filter(a => a.created_at < fimExclusivo)

    const { movimentos, saldoFinal } = montarContaCorrente({
      saldoAnterior, compras: comprasMes, presencas: presencasMes, ajustes: ajustesMes,
    })

    if (movimentos.length === 0 && saldoFinal === 0) continue

    saldoTotal += saldoFinal
    totalPresencas += presencasMes.length
    totalPago += comprasMes.reduce((s, c) => s + c.valor_pago, 0)

    const linhas = movimentos.map((m: MovimentoExtrato) => {
      const ehCredito = m.tipo === 'compra'
      const ehCortesia = ehCredito && (m.valorPago ?? 0) === 0
      const bg = ehCredito ? '#f0fdf4' : '#ffffff'
      const desc = ehCredito
        ? `<strong style="color:#15803d;">${ehCortesia ? 'Diárias cortesia' : 'Pacote pago'} — ${m.dias} diária${m.dias !== 1 ? 's' : ''}</strong>
           <br><span style="color:#6b7280;font-size:12px;">${ehCortesia ? 'Adicionado em ' : 'Pago em '}${formatarData(m.data)}${ehCortesia ? '' : ` · ${fmtMoeda(m.valorPago ?? 0)}`}${m.formaPagamento && !ehCortesia ? ` · ${FORMA_LABELS[m.formaPagamento] ?? m.formaPagamento}` : ''}</span>`
        : m.tipo === 'ajuste'
          ? `${m.descricao}<br><span style="color:#9ca3af;font-size:12px;">${formatarData(m.data)}</span>`
          : `Presença na creche<br><span style="color:#9ca3af;font-size:12px;">${formatarData(m.data)}</span>`
      const deltaCor = m.dias > 0 ? '#16a34a' : '#dc2626'
      return `
      <tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${desc}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${deltaCor};white-space:nowrap;">${m.dias > 0 ? '+' : ''}${m.dias}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${corSaldo(m.saldoApos)};white-space:nowrap;">${m.saldoApos}d</td>
      </tr>`
    }).join('')

    blocosPets.push(`
    <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#f9fafb;padding:12px 16px;display:flex;justify-content:space-between;">
        <span style="font-weight:700;color:#1f2937;font-size:15px;">🐾 ${pet.nome}${pet.identificador ? ` <span style="color:#9ca3af;font-weight:400;font-size:12px;">(${pet.identificador})</span>` : ''}</span>
        <span style="font-weight:700;color:${corSaldo(saldoFinal)};">${diariasLabel(saldoFinal)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#fafafa;">
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Saldo anterior</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"></td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${corSaldo(saldoAnterior)};white-space:nowrap;">${saldoAnterior}d</td>
        </tr>
        ${linhas}
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;font-weight:700;color:#1f2937;font-size:13px;">Saldo no fim de ${MESES[mes]}</td>
          <td></td>
          <td style="padding:10px 12px;text-align:right;font-weight:800;color:${corSaldo(saldoFinal)};white-space:nowrap;">${diariasLabel(saldoFinal)}</td>
        </tr>
      </table>
    </div>`)
  }

  const saldoTexto = saldoTotal < 0 ? `${diariasLabel(Math.abs(saldoTotal))} a pagar` : diariasLabel(saldoTotal)
  const saldoNota = saldoTotal < 0 ? 'Saldo negativo — diárias usadas além do pacote pago.'
    : saldoTotal > 0 ? 'Diárias pagas e ainda não usadas.' : 'Conta zerada.'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">
  <div style="background:#8A05BE;padding:32px;text-align:center;">
    <h1 style="margin:0;color:white;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🐾 Play Dog</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Creche e Hotel Canino · Juiz de Fora/MG</p>
    <div style="margin-top:16px;background:rgba(255,255,255,.15);border-radius:12px;padding:12px 24px;display:inline-block;">
      <p style="margin:0;color:white;font-size:18px;font-weight:700;">Extrato — ${MESES[mes]}/${ano}</p>
    </div>
  </div>
  <div style="padding:24px 32px;background:#faf5ff;border-bottom:1px solid #f3e8ff;">
    <p style="margin:0;font-size:13px;color:#9ca3af;">Tutor</p>
    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1f2937;">${tutor.nome}</p>
    ${tutor.email ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${tutor.email}</p>` : ''}
  </div>
  <div style="padding:24px 32px;">
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Saldo de diárias</p>
      <p style="margin:6px 0 2px;font-size:30px;font-weight:800;color:${corSaldo(saldoTotal)};">${saldoTexto}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">${saldoNota}</p>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#f3f4f6;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:26px;font-weight:800;color:#8A05BE;">${totalPresencas}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Presenças no mês</p>
      </div>
      ${totalPago > 0 ? `<div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#16a34a;">${fmtMoeda(totalPago)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Pago no mês</p>
      </div>` : ''}
    </div>
    ${blocosPets.length > 0 ? blocosPets.join('') : '<p style="text-align:center;color:#9ca3af;padding:20px;">Sem movimentações neste mês.</p>'}
    <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
      Conta corrente de diárias: cada presença usa 1 diária; cada pacote pago adiciona diárias. O saldo acumulado aparece à direita.
    </p>
  </div>
  <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Play Dog · Juiz de Fora/MG · Este é um e-mail automático</p>
  </div>
</div>
</body></html>`
}
