-- ============================================================
-- Módulo Fornecedores + vínculo de favorecido na despesa
-- Aditivo e idempotente — seguro rodar em produção.
-- ============================================================

-- 1. Tabela de fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid DEFAULT '00000000-0000-0000-0000-000000000001',
  nome          text NOT NULL,
  cnpj          text,
  categoria     text,
  contato_nome  text,
  telefone      text,
  email         text,
  endereco      text,
  observacoes   text,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fornecedores_all" ON public.fornecedores;
CREATE POLICY "fornecedores_all" ON public.fornecedores
  FOR ALL
  USING (public.get_my_role() IN ('admin', 'recepcao'))
  WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON public.fornecedores(ativo);

-- 2. Vínculo de favorecido na despesa
--    funcionario_id já existe (criado em funcionarios.sql); garantimos os dois.
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fornecedor_id  uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON public.despesas(fornecedor_id);
