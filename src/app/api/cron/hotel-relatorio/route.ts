import { NextResponse } from 'next/server'
import { hojeLocal } from '@/lib/datas'

// Cron job: GET /api/cron/hotel-relatorio
// Configure no Vercel Cron: "0 11 * * *" (8h BRT = 11h UTC)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = hojeLocal()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const res = await fetch(`${baseUrl}/api/hotel/relatorio-diario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET ?? '' },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err.error ?? 'Falha ao enviar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
