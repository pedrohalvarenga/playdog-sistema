import { jsPDF } from 'jspdf'

export interface VacinaPDF { label: string; vencimento: string; vencida: boolean }
export interface OcorrenciaPDF { data: string; descricao: string }
export interface PetPDF {
  nome: string
  detalhe: string        // ex.: "Vira-lata caramelo · Médio · 3 anos"
  tutor: string          // ex.: "Marina Costa · (32) 99876-5432"
  fotoUrl?: string | null
  presencas: string[]    // ex.: ["02/06 (seg)", ...]
  ocorrencias: OcorrenciaPDF[]
  vacinas: VacinaPDF[]
}
export interface RelatorioPDF {
  periodoLabel: string
  totalPresencas: number
  totalCaes: number
  totalTutores: number
  pets: PetPDF[]
}

type RGB = [number, number, number]
const PURPLE: RGB = [138, 5, 190]
const ORANGE: RGB = [255, 86, 0]
const TEAL: RGB = [0, 185, 166]
const DARK: RGB = [44, 44, 42]
const GRAY: RGB = [136, 135, 128]
const LINE: RGB = [233, 230, 222]
const CHIP_BG: RGB = [244, 240, 251]
const CHIP_TX: RGB = [60, 52, 137]
const FOOT: RGB = [95, 94, 90]

const W = 210, H = 297, M = 14, CW = W - 2 * M

async function carregarImagem(url: string): Promise<{ data: string; w: number; h: number; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const dim = await new Promise<{ w: number; h: number }>(resolve => {
      const im = new Image()
      im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 })
      im.onerror = () => resolve({ w: 1, h: 1 })
      im.src = data
    })
    const fmt = data.includes('image/png') ? 'PNG' : 'JPEG'
    return { data, w: dim.w, h: dim.h, fmt }
  } catch {
    return null
  }
}

export async function gerarRelatorioPDF(d: RelatorioPDF): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await carregarImagem('/logo-playdog.png')

  // Pré-carrega as fotos dos pets (em paralelo)
  const fotos = await Promise.all(
    d.pets.map(p => (p.fotoUrl ? carregarImagem(p.fotoUrl) : Promise.resolve(null))),
  )

  function barra() {
    doc.setFillColor(...PURPLE); doc.rect(0, 0, W / 3, 2, 'F')
    doc.setFillColor(...ORANGE); doc.rect(W / 3, 0, W / 3, 2, 'F')
    doc.setFillColor(...TEAL); doc.rect((2 * W) / 3, 0, W / 3, 2, 'F')
  }

  function rodape() {
    const fy = H - 12
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, fy - 4, W - M, fy - 4)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.setTextColor(...FOOT)
    doc.text('WhatsApp (32) 99165-1894   ·   @playdogjf   ·   playdogjf.com.br', W / 2, fy, { align: 'center' })
    doc.setTextColor(...GRAY)
    doc.text('Av. Presidente Costa e Silva, 2354 — São Pedro · Juiz de Fora / MG', W / 2, fy + 4, { align: 'center' })
  }

  let y = 0

  function novaPagina(comCabecalho = false) {
    rodape()
    doc.addPage()
    barra()
    y = comCabecalho ? 0 : 12
  }

  function garantir(espaco: number) {
    if (y + espaco > H - 18) novaPagina()
  }

  // ---------- Página 1: cabeçalho ----------
  barra()
  if (logo) {
    const h = 14, w = (logo.w / logo.h) * h
    doc.addImage(logo.data, logo.fmt, M, 7, w, h)
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...PURPLE)
    doc.text('Play Dog', M, 16)
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
  doc.text('Relatório de presenças', W - M, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...PURPLE)
  doc.text(d.periodoLabel, W - M, 18, { align: 'right' })

  // Faixa de resumo
  y = 26
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  const col = CW / 3
  const metric = (x: number, valor: string, rotulo: string, cor: RGB) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...cor)
    doc.text(valor, x, y + 7, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
    doc.text(rotulo, x, y + 12, { align: 'center' })
  }
  metric(M + col / 2, String(d.totalPresencas), 'Presenças no período', PURPLE)
  metric(M + col * 1.5, String(d.totalCaes), 'Cães', TEAL)
  metric(M + col * 2.5, String(d.totalTutores), 'Tutores', ORANGE)
  doc.line(M + col, y + 1, M + col, y + 13)
  doc.line(M + col * 2, y + 1, M + col * 2, y + 13)
  doc.line(M, y + 15, W - M, y + 15)
  y += 22

  // ---------- Pets ----------
  d.pets.forEach((pet, i) => {
    garantir(34)
    const foto = fotos[i]
    const fotoSize = 16
    if (foto) {
      doc.addImage(foto.data, foto.fmt, M, y, fotoSize, fotoSize)
    } else {
      doc.setFillColor(...CHIP_BG); doc.roundedRect(M, y, fotoSize, fotoSize, 2, 2, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...PURPLE)
      doc.text(pet.nome.charAt(0).toUpperCase(), M + fotoSize / 2, y + fotoSize / 2 + 2, { align: 'center' })
    }
    const tx = M + fotoSize + 5
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...PURPLE)
    doc.text(pet.nome, tx, y + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
    if (pet.detalhe) doc.text(doc.splitTextToSize(pet.detalhe, CW - fotoSize - 5)[0], tx, y + 10)
    if (pet.tutor) doc.text(doc.splitTextToSize(`Tutor: ${pet.tutor}`, CW - fotoSize - 5)[0], tx, y + 14.5)
    y += fotoSize + 4

    // Presenças
    garantir(10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PURPLE)
    doc.text(`PRESENÇAS NO PERÍODO (${pet.presencas.length})`, M, y)
    y += 5
    if (pet.presencas.length === 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
      doc.text('Sem presenças no período.', M, y)
      y += 5
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
      let cx = M
      pet.presencas.forEach(chip => {
        const tw = doc.getTextWidth(chip) + 6
        if (cx + tw > W - M) { cx = M; y += 7; garantir(8) }
        doc.setFillColor(...CHIP_BG); doc.roundedRect(cx, y - 4, tw, 5.5, 1.4, 1.4, 'F')
        doc.setTextColor(...CHIP_TX); doc.text(chip, cx + 3, y)
        cx += tw + 2
      })
      y += 8
    }

    // Observações
    if (pet.ocorrencias.length > 0) {
      garantir(12)
      doc.setDrawColor(...LINE); doc.line(M, y - 2, W - M, y - 2)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ORANGE)
      doc.text('OBSERVAÇÕES NO PERÍODO', M, y + 2)
      y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
      pet.ocorrencias.forEach(o => {
        const linhas = doc.splitTextToSize(`${o.data} — ${o.descricao}`, CW) as string[]
        linhas.forEach(l => { garantir(6); doc.text(l, M, y); y += 4.5 })
      })
      y += 2
    }

    // Vacinas
    if (pet.vacinas.length > 0) {
      garantir(12)
      doc.setDrawColor(...LINE); doc.line(M, y - 2, W - M, y - 2)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ORANGE)
      doc.text('VACINA(S) A VENCER (PRÓXIMOS 30 DIAS)', M, y + 2)
      y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
      pet.vacinas.forEach(v => {
        const txt = `${v.label} ${v.vencida ? 'venceu em' : 'vence em'} ${v.vencimento} — recomendamos agendar o reforço.`
        const linhas = doc.splitTextToSize(txt, CW) as string[]
        linhas.forEach(l => { garantir(6); doc.text(l, M, y); y += 4.5 })
      })
      y += 2
    }

    y += 6
    if (i < d.pets.length - 1) { garantir(6) }
  })

  rodape()
  return doc
}
