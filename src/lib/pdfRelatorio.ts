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
  ultimoPacoteData: string | null
  saldoNoDiaPacote: number | null
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

function imgFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG'
}

/**
 * Gera o PDF do relatório desenhando texto vetorial direto com jsPDF.
 * Não usa html2canvas (que trava no Safari do iPhone): é JS puro, roda
 * de forma síncrona e funciona em qualquer aparelho. Paginação A4 automática.
 */
export function gerarRelatorioPdfVetor(d: RelatorioPDF): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 15, CW = W - 2 * M

  const PURPLE = [138, 5, 190]
  const ORANGE = [255, 86, 0]
  const TEAL = [0, 185, 166]
  const GRAY = [136, 135, 128]
  const DARK = [44, 44, 42]
  const LINE = [233, 229, 243]
  const CHIPBG = [244, 240, 251]
  const CHIPTX = [60, 52, 137]
  const BODY = [68, 68, 65]
  const RED = [220, 38, 38]

  const fill = (c: number[]) => doc.setFillColor(c[0], c[1], c[2])
  const txt = (c: number[]) => doc.setTextColor(c[0], c[1], c[2])
  const stroke = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2])

  let y = 0

  const barraTopo = () => {
    fill(PURPLE); doc.rect(0, 0, W / 3, 2, 'F')
    fill(ORANGE); doc.rect(W / 3, 0, W / 3, 2, 'F')
    doc.setFillColor(0, 233, 210); doc.rect((2 * W) / 3, 0, W - (2 * W) / 3, 2, 'F')
  }
  const rodape = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); txt(GRAY)
    doc.text('WhatsApp (32) 99165-1894   ·   @playdogjf   ·   playdogjf.com.br', W / 2, H - 11, { align: 'center' })
    doc.text('Av. Presidente Costa e Silva, 2354 — São Pedro · Juiz de Fora / MG', W / 2, H - 7, { align: 'center' })
  }
  const novaPagina = () => { doc.addPage(); barraTopo(); rodape(); y = 16 }
  const garantir = (espaco: number) => { if (y + espaco > H - 18) novaPagina() }

  // ---- Primeira página: cabeçalho ----
  barraTopo(); rodape(); y = 14
  let baseCabecalho = y
  if (d.logoDataUrl) {
    try { doc.addImage(d.logoDataUrl, imgFormat(d.logoDataUrl), M, y, 17, 14); baseCabecalho = y + 14 } catch { /* logo opcional */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); txt(DARK)
  doc.text('Relatório de presenças', W - M, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); txt(PURPLE)
  doc.text(d.periodoLabel || '', W - M, y + 10, { align: 'right' })
  y = Math.max(baseCabecalho, y + 14) + 7

  // ---- Um bloco por pet ----
  for (const p of d.pets) {
    garantir(42)

    // Foto (ou inicial)
    const fx = M, fy = y
    let temFoto = false
    if (p.fotoDataUrl) {
      try { doc.addImage(p.fotoDataUrl, imgFormat(p.fotoDataUrl), fx, fy, 18, 18); temFoto = true } catch { /* formato não suportado */ }
    }
    if (!temFoto) {
      fill(CHIPBG); doc.roundedRect(fx, fy, 18, 18, 3, 3, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); txt(PURPLE)
      doc.text((p.nome.charAt(0) || '?').toUpperCase(), fx + 9, fy + 12, { align: 'center' })
    }

    // Nome + detalhe + tutor
    const tx = fx + 23
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); txt(PURPLE)
    doc.text(p.nome, tx, fy + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); txt(GRAY)
    let ty = fy + 10
    if (p.detalhe) { doc.text(p.detalhe, tx, ty); ty += 4 }
    if (p.tutor) { doc.text('Tutor: ' + p.tutor, tx, ty); ty += 4 }
    y = Math.max(fy + 18, ty) + 5

    // Linha de números (presenças / saldo atual / último pacote pago)
    garantir(20)
    stroke(LINE); doc.line(M, y, M + CW, y)
    const colW = CW / 3
    const numero = (i: number, valor: string, label: string, cor: number[]) => {
      const cx = M + colW * i + colW / 2
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); txt(cor)
      doc.text(valor, cx, y + 7, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); txt(GRAY)
      doc.text(label, cx, y + 11.5, { align: 'center' })
    }
    numero(0, String(p.presencas.length), 'Presenças no período', PURPLE)
    numero(1, (p.saldo >= 0 ? '+' : '') + p.saldo, 'Saldo de diárias hoje', TEAL)

    // 3ª coluna: último pacote pago — saldo do pet naquele dia (pode ser negativo) + data
    const cx3 = M + colW * 2 + colW / 2
    if (p.ultimoPacoteData) {
      const sal = p.saldoNoDiaPacote ?? 0
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); txt(sal < 0 ? RED : TEAL)
      doc.text((sal >= 0 ? '+' : '') + sal, cx3, y + 7, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); txt(GRAY)
      doc.text('Saldo ao pagar pacote', cx3, y + 11.5, { align: 'center' })
      doc.text(p.ultimoPacoteData, cx3, y + 15, { align: 'center' })
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); txt(ORANGE)
      doc.text('—', cx3, y + 7, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); txt(GRAY)
      doc.text('Sem pacote pago', cx3, y + 11.5, { align: 'center' })
    }

    stroke(LINE)
    doc.line(M + colW, y + 1, M + colW, y + 16)
    doc.line(M + 2 * colW, y + 1, M + 2 * colW, y + 16)
    y += 17
    doc.line(M, y, M + CW, y)
    y += 7

    // Presenças (chips)
    garantir(9)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); txt(PURPLE)
    doc.text(`PRESENÇAS NO PERÍODO (${p.presencas.length})`, M, y)
    y += 5
    if (p.presencas.length === 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); txt(GRAY)
      doc.text('Sem presenças no período.', M, y + 3); y += 7
    } else {
      const chipH = 6, gap = 2
      let cx = M
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      for (const c of p.presencas) {
        const w = doc.getTextWidth(c) + 6
        if (cx + w > M + CW) { cx = M; y += chipH + gap; garantir(chipH + 4) }
        fill(CHIPBG); doc.roundedRect(cx, y, w, chipH, 1.5, 1.5, 'F')
        txt(CHIPTX); doc.text(c, cx + 3, y + 4)
        cx += w + gap
      }
      y += chipH + 5
    }

    // Observações
    if (p.ocorrencias.length) {
      garantir(11)
      stroke(LINE); doc.line(M, y, M + CW, y); y += 5
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); txt(ORANGE)
      doc.text('OBSERVAÇÕES NO PERÍODO', M, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); txt(BODY)
      for (const o of p.ocorrencias) {
        const linhas = doc.splitTextToSize(`${o.data} — ${o.descricao}`, CW) as string[]
        garantir(linhas.length * 4 + 2)
        doc.text(linhas, M, y); y += linhas.length * 4 + 1
      }
      y += 2
    }

    // Vacinas a vencer
    if (p.vacinas.length) {
      garantir(11)
      stroke(LINE); doc.line(M, y, M + CW, y); y += 5
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); txt(ORANGE)
      doc.text('VACINA(S) A VENCER (PRÓXIMOS 30 DIAS)', M, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); txt(BODY)
      for (const v of p.vacinas) {
        const t = `${v.label} ${v.vencida ? 'venceu em' : 'vence em'} ${v.vencimento} — recomendamos agendar o reforço.`
        const linhas = doc.splitTextToSize(t, CW) as string[]
        garantir(linhas.length * 4 + 2)
        doc.text(linhas, M, y); y += linhas.length * 4 + 1
      }
      y += 2
    }

    y += 9 // espaço entre pets
  }

  return doc
}
