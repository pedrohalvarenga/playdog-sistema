-- ============================================================
-- PLAY DOG — Módulo Financeiro Parte B
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- Tabela de orçamentos (metas de receita e teto de despesa por área/período)
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area           TEXT NOT NULL CHECK (area IN ('creche','hotel','loja','banho_tosa','transporte','outros','geral')),
  periodo        TEXT NOT NULL CHECK (periodo IN ('mensal','trimestral','semestral','anual')),
  ano            INTEGER NOT NULL,
  mes            INTEGER CHECK (mes BETWEEN 1 AND 12),
  trimestre      INTEGER CHECK (trimestre BETWEEN 1 AND 4),
  semestre       INTEGER CHECK (semestre BETWEEN 1 AND 2),
  meta_receita   NUMERIC(12,2) NOT NULL DEFAULT 0,
  teto_despesa   NUMERIC(12,2) NOT NULL DEFAULT 0,
  registrado_por UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de configurações gerais do sistema
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.configuracoes (chave, valor) VALUES
  ('caixa_minimo', '5000')
ON CONFLICT (chave) DO NOTHING;

-- RLS: orçamentos — somente admin
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_admin" ON public.orcamentos
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- RLS: configuracoes — somente admin
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_select" ON public.configuracoes
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "config_update" ON public.configuracoes
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- Índice para busca de orçamentos por período
CREATE INDEX IF NOT EXISTS idx_orcamentos_periodo ON public.orcamentos(ano, periodo, area);

-- ============================================================
-- FIM DO SCRIPT FINANCEIRO PARTE B
-- ============================================================
