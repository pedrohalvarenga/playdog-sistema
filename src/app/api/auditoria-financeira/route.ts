import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const EMAILS_AUDITORIA = ['pedroalvarengamkt@gmail.com', 'ac.staico@gmail.com']

const CAMPOS_LABELS: Record<string, string> = {
  data: 'Data', valor: 'Valor', area: 'Área', categoria: 'Categoria',
  forma_pagamento: 'Forma de pagamento', conta_id: 'Conta', taxa_cartao: 'Taxa cartão (%)',
  valor_liquido: 'Valor líquido', descricao: 'Descrição', status: 'Status',
  data_vencimento: 'Vencimento', num_diarias: 'Nº diárias', fornecedor: 'Fornecedor',
  recorrente: 'Recorrente', dia_vencimento: 'Dia vencimento', pet_id: 'Pet',
  tutor_id: 'Tutor', funcionario_id: 'Funcionário', mes_referencia: 'Mês referência',
}

function fmtValor(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (campo === 'valor' || campo === 'valor_liquido') {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

function tabelaCampos(registro: Record<string, unknown>, alteracoes?: Record<string, unknown>): string {
  const linhas: string[] = []
  const campos = Object.keys(CAMPOS_LABELS).filter(c => c in registro || (alteracoes && c in alteracoes))
  for (const c of campos) {
    const antes = fmtValor(c, registro[c])
    if (alteracoes && c in alteracoes) {
      const depois = fmtValor(c, alteracoes[c])
      const mudou = antes !== depois
      linhas.push(`<tr style="${mudou ? 'background:#fff7ed;' : ''}">
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">${CAMPOS_LABELS[c]}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${antes}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:${mudou ? 'bold' : 'normal'};color:${mudou ? '#c2410c' : '#333'};">${depois}</td>
      </tr>`)
    } else {
      linhas.push(`<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">${CAMPOS_LABELS[c]}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;" colspan="2">${antes}</td>
      </tr>`)
    }
  }
  return linhas.join('')
}

export async function POST(request: Request) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles').select('nome, role').eq('id', user.id).single()

  const body = await request.json()
  const { tipo, acao, registro, alteracoes } = body as {
    tipo: 'receita' | 'despesa'
    acao: 'editada' | 'excluida'
    registro: Record<string, unknown>
    alteracoes?: Record<string, unknown>
  }
  if (!tipo || !acao || !registro) {
    return NextResponse.json({ error: 'payload incompleto' }, { status: 400 })
  }

  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const quando = `${agora.toISOString().split('T')[0].split('-').reverse().join('/')} às ${agora.toISOString().slice(11, 16)} (Brasília)`
  const titulo = `${tipo === 'receita' ? 'Receita' : 'Despesa'} ${acao === 'editada' ? 'EDITADA' : 'EXCLUÍDA'}`
  const cor = acao === 'excluida' ? '#dc2626' : '#ea580c'

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
    <div style="background:${cor};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
      <h2 style="margin:0;font-size:18px;">⚠️ ${titulo}</h2>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Auditoria financeira — Play Dog Sistema</p>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:16px 20px;border-radius:0 0 12px 12px;">
      <p style="font-size:14px;color:#333;margin:0 0 4px;">
        <strong>Quem:</strong> ${perfil?.nome ?? 'Desconhecido'} (${user.email ?? 'sem e-mail'}) — perfil ${perfil?.role ?? '?'}
      </p>
      <p style="font-size:14px;color:#333;margin:0 0 12px;"><strong>Quando:</strong> ${quando}</p>
      <p style="font-size:14px;color:#333;margin:0 0 6px;"><strong>ID do lançamento:</strong> ${registro.id ?? '—'}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
        <tr style="background:#f8f8f8;">
          <th style="padding:6px 10px;text-align:left;color:#888;">Campo</th>
          <th style="padding:6px 10px;text-align:left;color:#888;">${alteracoes ? 'Antes' : 'Valor'}</th>
          <th style="padding:6px 10px;text-align:left;color:#888;">${alteracoes ? 'Depois' : ''}</th>
        </tr>
        ${tabelaCampos(registro, alteracoes)}
      </table>
    </div>
  </div>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Play Dog <noreply@playdog.com.br>',
    to: EMAILS_AUDITORIA,
    subject: `[Auditoria] ${titulo} por ${perfil?.nome ?? user.email} — ${fmtValor('valor', registro.valor)}`,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
