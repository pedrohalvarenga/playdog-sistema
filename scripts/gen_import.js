const XLSX = require('../node_modules/xlsx');
const fs = require('fs');

const wb = XLSX.readFile('C:/Users/Pedro Alvarenga/Downloads/Playdog_Controle_Financeiro (1).xlsx');
const ws = wb.Sheets['Lançamentos'];
const data = XLSX.utils.sheet_to_json(ws, {header:1, raw:false});
const rows = data.slice(4).filter(r => r && r[0] && r[1]);

function parseVal(s) {
  if (!s) return 0;
  // Excel exports with comma as thousands sep and dot as decimal: "R$ 1,282.50"
  return parseFloat(s.replace(/R\$\s*/g,'').replace(/,/g,'').trim()) || 0;
}
function parseDate(s) {
  if (!s) return null;
  const [d,m,y] = s.split('/');
  return y+'-'+m+'-'+d;
}
function mapArea(a) {
  const m = {
    'Creche':'creche','Hotel':'hotel','Banho e Tosa':'banho_tosa',
    'Pet Shop':'loja','Transporte':'transporte',
    'Geral / Administrativo':'geral','Geral/Administrativo':'geral',
    'Festa de Aniversário':'outros','Clínica Veterinária':'outros',
    'Outro Serviço Especializado':'outros','Sessão Fotográfica':'outros'
  };
  return m[a] || 'geral';
}
function mapCatReceita(c, area) {
  if (!c) return area === 'hotel' ? 'hotel' : area === 'banho_tosa' ? 'banho_tosa' : area === 'loja' ? 'venda_produto' : area === 'transporte' ? 'transporte' : 'outros';
  if (c.includes('Diária') || c === 'Receita — Creche') return 'diaria_avulsa';
  if (c.includes('Hotel') || c.includes('Hospedagem')) return 'hotel';
  if (c.includes('Banho') || c.includes('Tosa')) return 'banho_tosa';
  if (c.includes('Transporte')) return 'transporte';
  if (c.includes('Pet Shop') || c === 'Venda Pet Shop' || c === 'Receita — Pet Shop') return 'venda_produto';
  if (c.includes('Festa')) return 'festa';
  if (c.includes('Foto')) return 'foto';
  if (area === 'banho_tosa') return 'banho_tosa';
  if (area === 'hotel') return 'hotel';
  if (area === 'loja') return 'venda_produto';
  if (area === 'transporte') return 'transporte';
  return 'outros';
}
function mapCatDespesa(c) {
  if (!c) return 'outros';
  if (c.includes('Banho') || c.includes('Tosa')) return 'produtos_banho_tosa';
  if (c.includes('Compra de Produtos') || c.includes('Pet Shop')) return 'racao_petiscos';
  if (c.includes('Salário') || c.includes('Funcionário')) return 'salarios';
  if (c.includes('Empréstimo')) return 'outros';
  if (c.includes('Fatura') || c.includes('Pagamento Fatura')) return 'taxas_bancarias';
  if (c.includes('Transporte')) return 'combustivel';
  if (c.includes('Manutenção') || c.includes('Serviços Gerais')) return 'manutencao';
  if (c.includes('Contador')) return 'contador';
  if (c.includes('Internet') || c.includes('Água') || c.includes('Energia')) return 'agua_luz_internet';
  if (c.includes('Aluguel')) return 'aluguel';
  if (c.includes('FGTS') || c.includes('DARF') || c.includes('Guia') || c.includes('Imposto')) return 'impostos';
  if (c.includes('Marketing')) return 'marketing';
  if (c.includes('Taxa')) return 'taxas_bancarias';
  return 'outros';
}
function mapConta(c) {
  if (c === 'PagBank PJ') return 'pagbank_id';
  if (c === 'Pessoa Física') return 'c6_id';
  return 'din_id';
}
function mapForma(conta) {
  if (conta === 'Dinheiro') return 'dinheiro';
  return 'pix';
}
function esc(s) {
  if (!s) return 'NULL';
  return "'" + String(s).replace(/'/g,"''").trim() + "'";
}

const lines = [];
lines.push('DO $$ DECLARE pagbank_id UUID; c6_id UUID; din_id UUID;');
lines.push('BEGIN');
lines.push("  SELECT id INTO pagbank_id FROM contas_financeiras WHERE tipo='pagbank_pj' LIMIT 1;");
lines.push("  SELECT id INTO c6_id FROM contas_financeiras WHERE tipo='c6_pf' LIMIT 1;");
lines.push("  SELECT id INTO din_id FROM contas_financeiras WHERE tipo='dinheiro' LIMIT 1;");
lines.push('');

let rec = 0, dep = 0;
for (const r of rows) {
  const [rawDate, tipo, rawVal, rawArea, rawCat, tipoCusto, rawConta, status, descricao, lancadoPor, mes, nomePet] = r;
  const dataD = parseDate(rawDate);
  const valor = parseVal(rawVal);
  const area = mapArea(rawArea);
  const contaVar = mapConta(rawConta);
  const statusPg = status === 'Realizado' ? 'pago' : 'pendente';

  // Build description including pet name
  let desc = '';
  if (descricao && nomePet && descricao.trim() !== nomePet.trim()) {
    desc = descricao.trim() + ' | Pet: ' + nomePet.trim();
  } else if (nomePet) {
    desc = nomePet.trim();
  } else if (descricao) {
    desc = descricao.trim();
  }

  if (tipo === 'Entrada') {
    const cat = mapCatReceita(rawCat, area);
    const forma = mapForma(rawConta);
    lines.push(`  INSERT INTO receitas (data, valor, area, categoria, forma_pagamento, conta_id, status, descricao) VALUES ('${dataD}', ${valor}, '${area}', '${cat}', '${forma}', ${contaVar}, '${statusPg}', ${esc(desc)});`);
    rec++;
  } else {
    const cat = mapCatDespesa(rawCat);
    const investimento = (rawCat && rawCat.toLowerCase().includes('investimento')) ? 'true' : 'false';
    lines.push(`  INSERT INTO despesas (data, valor, area, categoria, conta_id, status, descricao, investimento) VALUES ('${dataD}', ${valor}, '${area}', '${cat}', ${contaVar}, '${statusPg}', ${esc(desc)}, ${investimento});`);
    dep++;
  }
}

lines.push('END $$;');

const sql = lines.join('\n');
fs.writeFileSync('C:/Play Dog/playdog-sistema/supabase/import_lancamentos.sql', sql);
console.log(`Gerado: ${rec} receitas, ${dep} despesas. Total: ${rec+dep} linhas.`);
