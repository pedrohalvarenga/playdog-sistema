import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Chamado automaticamente pelo Vercel Cron todo dia 1º às 8h
export async function GET() {
  const supabase = await createClient()

  // Verifica se envio automático está habilitado
  const { data: config } = await supabase
    .from('config_creche')
    .select('chave, valor')
    .in('chave', ['envio_extrato_automatico', 'dia_envio_extrato'])

  const habilitado = config?.find(c => c.chave === 'envio_extrato_automatico')?.valor === 'true'
  if (!habilitado) return NextResponse.json({ skipped: 'envio automático desabilitado' })

  const diaEnvio = Number(config?.find(c => c.chave === 'dia_envio_extrato')?.valor ?? '1')
  const hoje = new Date()
  if (hoje.getDate() !== diaEnvio) return NextResponse.json({ skipped: `hoje não é dia ${diaEnvio}` })

  // Calcula mês anterior
  const mesRef = hoje.getMonth() === 0 ? 12 : hoje.getMonth()
  const anoRef = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()

  // Busca todos os tutores com e-mail
  const { data: tutores } = await supabase
    .from('tutores')
    .select('id, email, nome')
    .not('email', 'is', null)
    .neq('email', '')

  if (!tutores || tutores.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Nenhum tutor com e-mail' })
  }

  let enviados = 0
  let erros = 0

  for (const tutor of tutores) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email/enviar-extrato`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_id: tutor.id, mes: mesRef, ano: anoRef }),
    })
    if (res.ok) enviados++
    else erros++
  }

  return NextResponse.json({ enviados, erros, mes: mesRef, ano: anoRef })
}
