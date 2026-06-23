import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { diaLocal } from '@/lib/datas'

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const FORMA_LABELS: Record<string, string> = {
  pix_pagbank: 'Pix PagBank', pix_c6: 'Pix C6',
  dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito',
}

export async function POST(request: Request) {
  const { tutor_id, mes, ano } = await request.json()
  if (!tutor_id || !mes || !ano) {
    return NextResponse.json({ error: 'tutor_id, mes e ano são obrigatórios' }, { status: 400 })
  }

  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  // Aceita usuário logado OU chamada interna (cron/lote) com segredo
  const isInternal = request.headers.get('x-internal-secret') === process.env.CRON_SECRET
  if (!user && !isInternal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Leituras/escritas via service-role (funciona tanto para usuário quanto p/ cron)
  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = diaLocal(new Date(ano, mes, 0))

  const [{ data: tutor }, { data: pets }] = await Promise.all([
    supabase.from('tutores').select('*').eq('id', tutor_id).single(),
    supabase.from('pets').select('*').eq('tutor_id', tutor_id).eq('ativo', true),
  ])

  if (!tutor?.email) {
    return NextResponse.json({ error: 'Tutor não tem e-mail cadastrado' }, { status: 400 })
  }

  const petIds = (pets ?? []).map((p: { id: string }) => p.id)

  const [{ data: presencas }, { data: compras }] = await Promise.all([
    supabase.from('presencas').select('*, pet:pets(nome,identificador)').in('pet_id', petIds).gte('data', inicio).lte('data', fim).order('data'),
    supabase.from('compras_diarias').select('*, pet:pets(nome)').in('pet_id', petIds).gte('data', inicio).lte('data', fim).order('data'),
  ])

  const html = gerarHtmlExtrato({
    tutor,
    pets: pets ?? [],
    presencas: presencas ?? [],
    compras: compras ?? [],
    mes,
    ano,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Play Dog <noreply@playdog.com.br>',
    to: [tutor.email],
    subject: `Extrato Play Dog — ${MESES[mes]}/${ano}`,
    html,
  })

  // Registra o envio
  const status = emailError ? 'erro' : 'enviado'
  await supabase.from('envios_extrato').insert({
    tutor_id,
    mes,
    ano,
    status,
    erro: emailError ? JSON.stringify(emailError) : null,
  })

  if (emailError) {
    return NextResponse.json({ error: 'Erro ao enviar e-mail: ' + JSON.stringify(emailError) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function formatarData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function formatarHora(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function gerarHtmlExtrato({ tutor, pets, presencas, compras, mes, ano }: {
  tutor: Record<string, string>
  pets: Record<string, string>[]
  presencas: Record<string, unknown>[]
  compras: Record<string, unknown>[]
  mes: number
  ano: number
}) {
  const totalPresencas = presencas.length
  const totalPago = (compras as { valor_pago: number }[]).reduce((s, c) => s + (c.valor_pago ?? 0), 0)

  const linhasPresencas = presencas.map(p => {
    const pet = p.pet as { nome: string; identificador?: string }
    return `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${pet?.nome ?? ''}${pet?.identificador ? ` (${pet.identificador})` : ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${formatarData(p.data as string)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${formatarHora(p.checkin_at as string)} → ${formatarHora(p.checkout_at as string)}</td>
      </tr>`
  }).join('')

  const linhasCompras = compras.map(c => {
    const pet = c.pet as { nome: string }
    const cp = c as { quantidade: number; valor_pago: number; forma_pagamento: string; data: string }
    return `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${pet?.nome ?? ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${formatarData(cp.data)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${cp.quantidade} diária${cp.quantidade !== 1 ? 's' : ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:#16a34a;">R$ ${(cp.valor_pago ?? 0).toFixed(2).replace('.', ',')}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;color:#9ca3af;">${FORMA_LABELS[cp.forma_pagamento] ?? cp.forma_pagamento}</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">
  <!-- Header -->
  <div style="background:#8A05BE;padding:32px;text-align:center;">
    <h1 style="margin:0;color:white;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🐾 Play Dog</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Creche e Hotel Canino · Juiz de Fora/MG</p>
    <div style="margin-top:16px;background:rgba(255,255,255,.15);border-radius:12px;padding:12px 24px;display:inline-block;">
      <p style="margin:0;color:white;font-size:18px;font-weight:700;">Extrato — ${MESES[mes]}/${ano}</p>
    </div>
  </div>
  <!-- Tutor info -->
  <div style="padding:24px 32px;background:#faf5ff;border-bottom:1px solid #f3e8ff;">
    <p style="margin:0;font-size:13px;color:#9ca3af;">Tutor</p>
    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1f2937;">${tutor.nome}</p>
    ${tutor.email ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${tutor.email}</p>` : ''}
  </div>
  <!-- Resumo -->
  <div style="padding:24px 32px;">
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#f3f4f6;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:800;color:#8A05BE;">${totalPresencas}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Presenças</p>
      </div>
      <div style="flex:1;background:#f3f4f6;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:800;color:#16a34a;">${pets.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Pet${pets.length !== 1 ? 's' : ''}</p>
      </div>
      ${totalPago > 0 ? `<div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#16a34a;">R$ ${totalPago.toFixed(2).replace('.', ',')}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Total pago</p>
      </div>` : ''}
    </div>
    ${presencas.length > 0 ? `
    <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Presenças</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Pet</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Data</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Horário</th>
      </tr></thead>
      <tbody>${linhasPresencas}</tbody>
    </table>` : ''}
    ${compras.length > 0 ? `
    <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Diárias Compradas</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Pet</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Data</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Qtd</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Valor</th>
        <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-weight:600;">Forma</th>
      </tr></thead>
      <tbody>${linhasCompras}</tbody>
    </table>` : ''}
  </div>
  <!-- Footer -->
  <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Play Dog · Juiz de Fora/MG · Este é um e-mail automático</p>
  </div>
</div>
</body></html>`
}
