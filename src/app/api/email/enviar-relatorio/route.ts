import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { parseISO } from 'date-fns'

const PORTE_LABELS: Record<string, string> = { P: 'Pequeno', M: 'Médio', G: 'Grande' }

const VACINAS: { campo: string; label: string }[] = [
  { campo: 'vacina_v8_v10', label: 'V8/V10' },
  { campo: 'vacina_antirabica', label: 'Antirrábica' },
  { campo: 'vacina_gripe', label: 'Gripe' },
  { campo: 'vacina_giardia', label: 'Giardia' },
]

const pad = (n: number) => String(n).padStart(2, '0')

function addDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function fmt(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtData(d: string) {
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR')
}

/** Retorna o vencimento (YYYY-MM-DD) se a vacina vence em até 30 dias ou já venceu; senão null. */
function vacinaAVencer(dataDose: string | null | undefined): { venc: string; vencida: boolean } | null {
  if (!dataDose || dataDose === 'NAO_VACINADO') return null
  const dose = parseISO(dataDose)
  const dias = Math.floor((Date.now() - dose.getTime()) / 86_400_000)
  if (dias > 365) return { venc: addDias(dataDose, 365), vencida: true }
  if (dias > 335) return { venc: addDias(dataDose, 365), vencida: false }
  return null
}

export async function POST(request: Request) {
  const { tutor_id, inicio, fim, pet_id } = await request.json()
  if (!tutor_id || !inicio || !fim) {
    return NextResponse.json({ error: 'tutor_id, inicio e fim são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: tutor } = await supabase.from('tutores').select('*').eq('id', tutor_id).single()
  if (!tutor?.email) {
    return NextResponse.json({ error: 'Tutor não tem e-mail cadastrado' }, { status: 400 })
  }

  let petsQuery = supabase.from('pets').select('*').eq('tutor_id', tutor_id).eq('ativo', true)
  if (pet_id) petsQuery = petsQuery.eq('id', pet_id)
  const { data: pets } = await petsQuery
  const petIds = (pets ?? []).map((p: { id: string }) => p.id)

  if (petIds.length === 0) {
    return NextResponse.json({ error: 'Nenhum pet encontrado para este tutor' }, { status: 400 })
  }

  const [{ data: presencas }, { data: ocorrencias }] = await Promise.all([
    supabase.from('presencas').select('*').in('pet_id', petIds).gte('data', inicio).lte('data', fim).order('data'),
    supabase.from('ocorrencias').select('*').in('pet_id', petIds).gte('created_at', `${inicio}T00:00:00`).lte('created_at', `${fim}T23:59:59`).order('created_at'),
  ])

  const html = gerarHtml({ tutor, pets: pets ?? [], presencas: presencas ?? [], ocorrencias: ocorrencias ?? [], inicio, fim })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Play Dog <noreply@playdogjf.com.br>',
    to: [tutor.email],
    subject: `Relatório de presenças — Play Dog (${fmt(inicio)} a ${fmt(fim)})`,
    html,
  })

  if (emailError) {
    return NextResponse.json({ error: 'Erro ao enviar e-mail: ' + JSON.stringify(emailError) }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

function gerarHtml({ tutor, pets, presencas, ocorrencias, inicio, fim }: {
  tutor: Record<string, string>
  pets: Record<string, string | null>[]
  presencas: { pet_id: string; data: string }[]
  ocorrencias: { pet_id: string; descricao: string; created_at: string }[]
  inicio: string
  fim: string
}) {
  const totalPresencas = presencas.length

  const blocosPets = pets.map(pet => {
    const pPres = presencas.filter(p => p.pet_id === pet.id)
    const pOco = ocorrencias.filter(o => o.pet_id === pet.id)
    const vacs = VACINAS.map(v => {
      const r = vacinaAVencer(pet[v.campo])
      return r ? { label: v.label, ...r } : null
    }).filter(Boolean) as { label: string; venc: string; vencida: boolean }[]

    if (pPres.length === 0 && pOco.length === 0 && vacs.length === 0) return ''

    const chips = pPres.map(p =>
      `<span style="display:inline-block;background:#F4F0FB;border-radius:8px;padding:4px 9px;font-size:12px;color:#3C3489;margin:0 5px 5px 0;">${fmtData(p.data)}</span>`,
    ).join('')

    const foto = pet.foto_url
      ? `<img src="${pet.foto_url}" alt="" width="54" height="54" style="width:54px;height:54px;border-radius:13px;object-fit:cover;border:2px solid #EEEDFE;" />`
      : `<div style="width:54px;height:54px;border-radius:13px;background:#F4F0FB;text-align:center;line-height:54px;color:#8A05BE;font-weight:700;font-size:20px;">${(pet.nome ?? '?').charAt(0)}</div>`

    const detalhe = [pet.identificador, pet.raca, PORTE_LABELS[pet.porte ?? ''] ?? null].filter(Boolean).join(' · ')

    const blocoOco = pOco.length > 0
      ? `<div style="padding:10px 0;border-top:1px solid #F1EFE8;">
           <p style="margin:0 0 5px;font-size:11px;font-weight:600;color:#FF5600;text-transform:uppercase;letter-spacing:.04em;">Observações no período</p>
           ${pOco.map(o => `<p style="margin:0 0 3px;font-size:12px;color:#444441;line-height:1.5;">${fmtData(o.created_at)} — ${o.descricao}</p>`).join('')}
         </div>` : ''

    const blocoVac = vacs.length > 0
      ? `<div style="padding:10px 0;border-top:1px solid #F1EFE8;">
           <p style="margin:0 0 5px;font-size:11px;font-weight:600;color:#FF5600;text-transform:uppercase;letter-spacing:.04em;">Vacina(s) a vencer (próximos 30 dias)</p>
           ${vacs.map(v => `<p style="margin:0;font-size:12px;color:#444441;line-height:1.5;">${v.label} ${v.vencida ? 'venceu em' : 'vence em'} ${fmt(v.venc)} — recomendamos agendar o reforço.</p>`).join('')}
         </div>` : ''

    return `<div style="margin-bottom:22px;">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        ${foto}
        <div>
          <p style="margin:0;font-size:16px;font-weight:600;color:#8A05BE;">${pet.nome ?? ''}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#888780;">${detalhe}</p>
        </div>
      </div>
      <p style="margin:0 0 7px;font-size:11px;font-weight:600;color:#8A05BE;text-transform:uppercase;letter-spacing:.04em;">Presenças no período (${pPres.length})</p>
      <div>${chips || '<span style="font-size:12px;color:#888780;">Sem presenças no período.</span>'}</div>
      ${blocoOco}${blocoVac}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #eee;">
  <div style="display:flex;height:6px;"><div style="flex:1;background:#8A05BE;"></div><div style="flex:1;background:#FF5600;"></div><div style="flex:1;background:#00E9D2;"></div></div>
  <div style="padding:18px 24px;display:flex;align-items:center;justify-content:space-between;">
    <img src="https://playdog-sistema.vercel.app/logo-playdog.png" alt="Play Dog" height="48" style="height:48px;width:auto;" />
    <div style="text-align:right;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#2C2C2A;">Relatório de presenças</p>
      <p style="margin:3px 0 0;font-size:12px;color:#8A05BE;">${fmt(inicio)} a ${fmt(fim)}</p>
    </div>
  </div>
  <div style="padding:0 24px 6px;">
    <div style="border-top:1px solid #F1EFE8;border-bottom:1px solid #F1EFE8;padding:12px 0;text-align:center;margin-bottom:18px;">
      <span style="font-size:22px;font-weight:700;color:#8A05BE;">${totalPresencas}</span>
      <span style="font-size:12px;color:#888780;"> presença${totalPresencas !== 1 ? 's' : ''} de ${tutor.nome}</span>
    </div>
    ${blocosPets || '<p style="text-align:center;color:#888780;font-size:13px;padding:20px 0;">Sem movimentações no período.</p>'}
  </div>
  <div style="padding:16px 24px;background:#FBFAF8;border-top:1px solid #F1EFE8;text-align:center;">
    <p style="margin:0;font-size:12px;color:#5F5E5A;">WhatsApp (32) 99165-1894 · @playdogjf · playdogjf.com.br</p>
    <p style="margin:5px 0 0;font-size:11px;color:#888780;">Av. Presidente Costa e Silva, 2354 — São Pedro · Juiz de Fora / MG</p>
  </div>
</div>
</body></html>`
}
