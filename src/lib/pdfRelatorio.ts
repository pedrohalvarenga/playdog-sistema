import { jsPDF } from 'jspdf'

export interface VacinaPDF { label: string; vencimento: string; vencida: boolean }
export interface OcorrenciaPDF { data: string; descricao: string }
export interface PetPDF {
  nome: string
  detalhe: string
  tutor: string
  fotoDataUrl?: string | null
  presencas: string[]
  saldo: number
  ultimoPacote: number
  ocorrencias: OcorrenciaPDF[]
  vacinas: VacinaPDF[]
}
export interface RelatorioPDF {
  periodoLabel: string
  logoDataUrl?: string | null
  pets: PetPDF[]
}

/** Carrega uma imagem (URL absoluta ou relativa) como data URL — evita problemas de CORS na captura. */
export async function carregarImagemDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Monta o HTML do relatório (layout aprovado) — focado no(s) pet(s), sem contagem de tutores. */
export function montarHtmlRelatorio(d: RelatorioPDF): string {
  const cardPet = (p: PetPDF) => {
    const foto = p.fotoDataUrl
      ? `<img src="${p.fotoDataUrl}" alt="" style="width:60px;height:60px;border-radius:16px;object-fit:cover;border:2px solid #EEEDFE;flex:0 0 auto;" />`
      : `<div style="width:60px;height:60px;border-radius:16px;background:#F4F0FB;display:flex;align-items:center;justify-content:center;color:#8A05BE;font-weight:700;font-size:22px;flex:0 0 auto;">${esc(p.nome.charAt(0))}</div>`

    const chips = p.presencas.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${p.presencas
          .map(c => `<span style="background:#F4F0FB;border-radius:9px;padding:6px 11px;font-size:13px;color:#3C3489;font-weight:500;">${esc(c)}</span>`)
          .join('')}</div>`
      : `<div style="font-size:13px;color:#888780;">Sem presenças no período.</div>`

    const obs = p.ocorrencias.length
      ? `<div style="padding:12px 2px 2px;border-top:1px solid #F1EFE8;margin-top:14px;">
           <div style="font-size:11px;font-weight:600;color:#FF5600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;">Observações no período</div>
           ${p.ocorrencias.map(o => `<div style="font-size:13px;color:#444441;line-height:1.55;margin-bottom:3px;">${esc(o.data)} — ${esc(o.descricao)}</div>`).join('')}
         </div>`
      : ''

    const vac = p.vacinas.length
      ? `<div style="padding:12px 2px 2px;border-top:1px solid #F1EFE8;margin-top:14px;">
           <div style="font-size:11px;font-weight:600;color:#FF5600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;">Vacina(s) a vencer (próximos 30 dias)</div>
           ${p.vacinas.map(v => `<div style="font-size:13px;color:#444441;line-height:1.5;">${esc(v.label)} ${v.vencida ? 'venceu em' : 'vence em'} ${esc(v.vencimento)} — recomendamos agendar o reforço.</div>`).join('')}
         </div>`
      : ''

    const pacote = p.ultimoPacote > 0 ? String(p.ultimoPacote) : '—'

    return `<div style="page-break-inside:avoid;margin-bottom:26px;">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
        ${foto}
        <div style="min-width:0;">
          <div style="font-size:19px;font-weight:700;color:#8A05BE;line-height:1.1;">${esc(p.nome)}</div>
          ${p.detalhe ? `<div style="font-size:13px;color:#888780;margin-top:2px;">${esc(p.detalhe)}</div>` : ''}
          ${p.tutor ? `<div style="font-size:13px;color:#888780;">Tutor: ${esc(p.tutor)}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;border-top:1px solid #F1EFE8;border-bottom:1px solid #F1EFE8;padding:12px 0;margin-bottom:14px;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#8A05BE;">${p.presencas.length}</div>
          <div style="font-size:11px;color:#888780;">Presenças no período</div>
        </div>
        <div style="flex:1;text-align:center;border-left:1px solid #F1EFE8;border-right:1px solid #F1EFE8;">
          <div style="font-size:22px;font-weight:700;color:#00B9A6;">${p.saldo >= 0 ? '+' : ''}${p.saldo}</div>
          <div style="font-size:11px;color:#888780;">Saldo de diárias</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#FF5600;">${pacote}</div>
          <div style="font-size:11px;color:#888780;">Último pacote</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;color:#8A05BE;text-transform:uppercase;margin-bottom:9px;">Presenças no período (${p.presencas.length})</div>
      ${chips}
      ${obs}
      ${vac}
    </div>`
  }

  const logo = d.logoDataUrl
    ? `<img src="${d.logoDataUrl}" alt="Play Dog" style="height:50px;width:auto;" />`
    : `<div style="font-size:22px;font-weight:800;color:#8A05BE;">Play Dog</div>`

  return `<div style="width:760px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2C2C2A;box-sizing:border-box;">
    <div style="display:flex;height:7px;">
      <div style="flex:1;background:#8A05BE;"></div>
      <div style="flex:1;background:#FF5600;"></div>
      <div style="flex:1;background:#00E9D2;"></div>
    </div>
    <div style="padding:22px 32px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        ${logo}
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:700;color:#2C2C2A;">Relatório de presenças</div>
          <div style="display:inline-block;margin-top:4px;font-size:13px;color:#8A05BE;background:#F4F0FB;padding:4px 12px;border-radius:999px;">${esc(d.periodoLabel)}</div>
        </div>
      </div>
      ${d.pets.map(cardPet).join('')}
      <div style="margin-top:8px;padding-top:14px;border-top:1px solid #F1EFE8;text-align:center;">
        <div style="font-size:12px;color:#5F5E5A;">WhatsApp (32) 99165-1894&nbsp;&nbsp;·&nbsp;&nbsp;@playdogjf&nbsp;&nbsp;·&nbsp;&nbsp;playdogjf.com.br</div>
        <div style="font-size:12px;color:#888780;margin-top:4px;">Av. Presidente Costa e Silva, 2354 — São Pedro · Juiz de Fora / MG</div>
      </div>
    </div>
  </div>`
}

/**
 * Captura um elemento já renderizado e devolve um jsPDF com a página do
 * tamanho EXATO do conteúdo (como um card) — sem espaço em branco sobrando.
 */
export async function elementoParaPDF(el: HTMLElement): Promise<jsPDF> {
  const html2canvas = (await import('html2canvas-pro')).default
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const img = canvas.toDataURL('image/jpeg', 0.95)

  const pw = 210 // largura fixa (mm); a altura acompanha o conteúdo
  const ph = (canvas.height * pw) / canvas.width

  const pdf = new jsPDF({
    unit: 'mm',
    format: [pw, ph],
    orientation: ph >= pw ? 'portrait' : 'landscape',
  })
  pdf.addImage(img, 'JPEG', 0, 0, pw, ph)
  return pdf
}
