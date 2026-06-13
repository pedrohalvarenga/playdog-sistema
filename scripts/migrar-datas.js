// Migração: substitui extração de dia via UTC (toISOString) pelos
// helpers de fuso de Juiz de Fora em src/lib/datas.ts
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src')
let totalArquivos = 0
let totalTrocas = 0

function walk(dir) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(nome) && !p.endsWith(path.join('lib', 'datas.ts'))) migrar(p)
  }
}

function migrar(arquivo) {
  let src = fs.readFileSync(arquivo, 'utf8')
  const original = src
  let trocas = 0

  // 1) new Date().toISOString().split('T')[0]  →  hojeLocal()
  src = src.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, () => { trocas++; return 'hojeLocal()' })

  // 2) new Date(<expr>).toISOString().split('T')[0]  →  diaLocal(<expr>)
  src = src.replace(/new Date\(((?:[^()]|\([^()]*\))*)\)\.toISOString\(\)\.split\('T'\)\[0\]/g, (_, expr) => { trocas++; return `diaLocal(new Date(${expr}))` })

  // 3) <ident>.toISOString().split('T')[0]  →  diaLocal(<ident>)
  src = src.replace(/([A-Za-z_$][\w$.]*)\.toISOString\(\)\.split\('T'\)\[0\]/g, (_, ident) => { trocas++; return `diaLocal(${ident})` })

  if (trocas === 0) return

  // Garante o import dos helpers usados
  const precisa = []
  if (/\bhojeLocal\(/.test(src) && !/from '@\/lib\/datas'/.test(src)) precisa.push('hojeLocal')
  if (/\bdiaLocal\(/.test(src) && !/from '@\/lib\/datas'/.test(src)) precisa.push('diaLocal')
  // Se já existe import de datas, completa os nomes que faltam
  const importExistente = src.match(/import \{([^}]*)\} from '@\/lib\/datas'/)
  if (importExistente) {
    const atuais = importExistente[1].split(',').map(s => s.trim()).filter(Boolean)
    const querUsar = ['hojeLocal', 'diaLocal'].filter(n => new RegExp(`\\b${n}\\(`).test(src))
    const todos = [...new Set([...atuais, ...querUsar])]
    src = src.replace(/import \{[^}]*\} from '@\/lib\/datas'/, `import { ${todos.join(', ')} } from '@/lib/datas'`)
  } else {
    const querUsar = ['hojeLocal', 'diaLocal'].filter(n => new RegExp(`\\b${n}\\(`).test(src))
    if (querUsar.length) {
      // Insere após a última linha de import
      const linhas = src.split('\n')
      let ultimaImport = -1
      for (let i = 0; i < linhas.length; i++) {
        if (/^import /.test(linhas[i])) ultimaImport = i
      }
      linhas.splice(ultimaImport + 1, 0, `import { ${querUsar.join(', ')} } from '@/lib/datas'`)
      src = linhas.join('\n')
    }
  }

  if (src !== original) {
    fs.writeFileSync(arquivo, src, 'utf8')
    totalArquivos++
    totalTrocas += trocas
    console.log(`${trocas}x  ${path.relative(ROOT, arquivo)}`)
  }
}

walk(ROOT)
console.log(`\nTotal: ${totalTrocas} trocas em ${totalArquivos} arquivos`)
