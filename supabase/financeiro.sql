-- ============================================================
-- PLAY DOG — Módulo Financeiro (Parte A)
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABELA: contas_financeiras
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_financeiras (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('pagbank_pj', 'c6_pf', 'dinheiro')),
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: 3 contas principais
INSERT INTO public.contas_financeiras (nome, tipo, saldo_inicial) VALUES
  ('PagBank PJ',     'pagbank_pj', 0),
  ('C6 PF Wallace',  'c6_pf',      0),
  ('Dinheiro (Caixa)', 'dinheiro', 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: parcelamentos (contratos de parcelas / financiamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parcelamentos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  descricao             TEXT NOT NULL,
  valor_total           NUMERIC(12,2) NOT NULL,
  num_parcelas          INTEGER NOT NULL CHECK (num_parcelas > 0),
  valor_parcela         NUMERIC(12,2) NOT NULL,
  taxa_juros            NUMERIC(5,2),
  data_primeira_parcela DATE NOT NULL,
  conta_id              UUID REFERENCES public.contas_financeiras(id),
  area                  TEXT NOT NULL CHECK (area IN ('creche','hotel','loja','banho_tosa','transporte','outros','geral')),
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  registrado_por        UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: receitas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.receitas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  area            TEXT NOT NULL CHECK (area IN ('creche','hotel','loja','banho_tosa','transporte','outros','geral')),
  categoria       TEXT NOT NULL CHECK (categoria IN (
    'diaria_avulsa','pacote_semanal','pacote_mensal','hotel',
    'banho_tosa','transporte','venda_produto','festa','foto','outros'
  )),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('pix','dinheiro','debito','credito')),
  conta_id        UUID REFERENCES public.contas_financeiras(id),
  taxa_cartao     NUMERIC(5,2),
  valor_liquido   NUMERIC(12,2),
  tutor_id        UUID REFERENCES public.tutores(id),
  pet_id          UUID REFERENCES public.pets(id),
  descricao       TEXT,
  status          TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pago','pendente','cancelado')),
  data_vencimento DATE,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: despesas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.despesas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  area            TEXT NOT NULL CHECK (area IN ('creche','hotel','loja','banho_tosa','transporte','outros','geral')),
  categoria       TEXT NOT NULL CHECK (categoria IN (
    'racao_petiscos','limpeza','produtos_banho_tosa','salarios','comissoes',
    'combustivel','manutencao','investimento','aluguel','agua_luz_internet',
    'contador','marketing','impostos','taxas_bancarias','outros'
  )),
  conta_id        UUID REFERENCES public.contas_financeiras(id),
  fornecedor      TEXT,
  descricao       TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente','cancelado')),
  data_vencimento DATE,
  recorrente      BOOLEAN NOT NULL DEFAULT false,
  dia_vencimento  INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  parcelamento_id UUID REFERENCES public.parcelamentos(id),
  num_parcela     INTEGER,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_receitas_data     ON public.receitas(data);
CREATE INDEX IF NOT EXISTS idx_receitas_status   ON public.receitas(status);
CREATE INDEX IF NOT EXISTS idx_receitas_area     ON public.receitas(area);
CREATE INDEX IF NOT EXISTS idx_receitas_conta    ON public.receitas(conta_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data     ON public.despesas(data);
CREATE INDEX IF NOT EXISTS idx_despesas_status   ON public.despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_venc     ON public.despesas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_parcela  ON public.despesas(parcelamento_id);
CREATE INDEX IF NOT EXISTS idx_despesas_conta    ON public.despesas(conta_id);

-- ============================================================
-- VIEW: saldo por conta (calculado em tempo real)
-- ============================================================
CREATE OR REPLACE VIEW public.v_saldo_contas AS
SELECT
  c.id,
  c.nome,
  c.tipo,
  c.saldo_inicial,
  COALESCE(r.total_receitas, 0) AS total_receitas,
  COALESCE(d.total_despesas, 0) AS total_despesas,
  c.saldo_inicial
    + COALESCE(r.total_receitas, 0)
    - COALESCE(d.total_despesas, 0) AS saldo_atual
FROM public.contas_financeiras c
LEFT JOIN (
  SELECT conta_id, SUM(COALESCE(valor_liquido, valor)) AS total_receitas
  FROM public.receitas
  WHERE status = 'pago'
  GROUP BY conta_id
) r ON r.conta_id = c.id
LEFT JOIN (
  SELECT conta_id, SUM(valor) AS total_despesas
  FROM public.despesas
  WHERE status = 'pago'
  GROUP BY conta_id
) d ON d.conta_id = c.id
WHERE c.ativo = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelamentos      ENABLE ROW LEVEL SECURITY;

-- contas: leitura para admin e recepcao
CREATE POLICY "contas_select" ON public.contas_financeiras
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "contas_insert" ON public.contas_financeiras
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "contas_update" ON public.contas_financeiras
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- receitas: admin gerencia tudo; recepcao só insere e lê
CREATE POLICY "receitas_select" ON public.receitas
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "receitas_insert" ON public.receitas
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "receitas_update" ON public.receitas
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "receitas_delete" ON public.receitas
  FOR DELETE USING (public.get_my_role() = 'admin');

-- despesas: somente admin
CREATE POLICY "despesas_select" ON public.despesas
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "despesas_insert" ON public.despesas
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "despesas_update" ON public.despesas
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "despesas_delete" ON public.despesas
  FOR DELETE USING (public.get_my_role() = 'admin');

-- parcelamentos: somente admin
CREATE POLICY "parcelamentos_select" ON public.parcelamentos
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "parcelamentos_insert" ON public.parcelamentos
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "parcelamentos_update" ON public.parcelamentos
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- ============================================================
-- FIM DO SCRIPT FINANCEIRO
-- ============================================================
