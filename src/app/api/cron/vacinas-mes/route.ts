import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { addDays, parseISO, format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DESTINATARIO = 'ac.staico@gmail.com'
const VACINA_VALIDADE_DIAS = 365

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Busca todos os pets ativos com tutor
  const { data: pets, error } = await adminClient
    .from('pets')
    .select('*, tutor:tutores(nome, telefone)')
    .eq('ativo', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)

  type VacinaInfo = { pet: string; tutor: string; vacina: string; vencimento: string; status: 'vencida' | 'vence_este_mes' }
  const alertas: VacinaInfo[] = []

  const camposVacina = [
    { campo: 'vacina_v8_v10', label: 'V8/V10' },
    { campo: 'vacina_antirabica', label: 'Antirrábica' },
    { campo: 'vacina_gripe', label: 'Gripe' },
    { campo: 'vacina_giardia', label: 'Giardia' },
  ]

  for (const pet of (pets ?? [])) {
    const p = pet as any
    for (const { campo, label } of camposVacina) {
      if (!p[campo]) continue
      const dose = parseISO(p[campo])
      const vencimento = addDays(dose, VACINA_VALIDADE_DIAS)

      const vencida = vencimento < hoje
      const vencenteEsteMes = vencimento >= inicioMes && vencimento <= fimMes

      if (vencida || vencenteEsteMes) {
        alertas.push({
          pet: pet.nome,
          tutor: p.tutor?.nome ?? '—',
          vacina: label,
          vencimento: format(vencimento, 'dd/MM/yyyy', { locale: ptBR }),
          status: vencida ? 'vencida' : 'vence_este_mes',
        })
      }
    }
  }

  if (alertas.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Nenhuma vacina vencendo este mês' })
  }

  const mesAno = format(hoje, 'MMMM yyyy', { locale: ptBR })

  const linhas = alertas.map(a => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 12px;font-weight:600;">${a.pet}</td>
      <td style="padding:10px 12px;color:#666;">${a.tutor}</td>
      <td style="padding:10px 12px;">${a.vacina}</td>
      <td style="padding:10px 12px;">${a.vencimento}</td>
      <td style="padding:10px 12px;">
        <span style="background:${a.status === 'vencida' ? '#fee2e2' : '#fef9c3'};color:${a.status === 'vencida' ? '#b91c1c' : '#854d0e'};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">
          ${a.status === 'vencida' ? '🔴 Vencida' : '🟡 Vence este mês'}
        </span>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

    <div style="background:#8A05BE;padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">🐾 Play Dog</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Relatório de vacinas — ${mesAno}</p>
    </div>

    <div style="padding:28px 32px;">
      <p style="color:#374151;margin:0 0 20px;">Olá! Seguem os cães com vacinas <strong>vencidas ou que vencem em ${mesAno}</strong>:</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Pet</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Tutor</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Vacina</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Vencimento</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
        Total: ${alertas.length} vacina(s) a tratar. Esse relatório é enviado automaticamente no dia 1 de cada mês pelo sistema Play Dog.
      </p>
    </div>

  </div>
</body>
</html>`

  const { error: emailError } = await resend.emails.send({
    from: 'Play Dog <onboarding@resend.dev>',
    to: DESTINATARIO,
    subject: `🐾 Vacinas do mês — ${mesAno} | Play Dog`,
    html,
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })

  return NextResponse.json({ ok: true, enviado: true, alertas: alertas.length })
}
