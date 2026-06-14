-- ============================================================
-- Módulo Funcionários + Comissões
-- ESTENDE a tabela funcionarios já existente (não recria) e
-- adiciona regras de comissão, pagamentos de comissão e o
-- vínculo executado_por nas receitas.
-- Tudo aditivo e idempotente (IF NOT EXISTS) — seguro rodar
-- no banco de produção sem perder dados existentes.
-- ============================================================

-- 1. Estende funcionarios com os novos campos
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS empresa_id      uuid DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS cpf             text,
  ADD COLUMN IF NOT EXISTS rg              text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS foto_url        text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS telefone        text,
  ADD COLUMN IF NOT EXISTS data_admissao   date,
  ADD COLUMN IF NOT EXISTS tam_calca       text,
  ADD COLUMN IF NOT EXISTS tam_camisa      text,
  ADD COLUMN IF NOT EXISTS tam_sapato      text,
  ADD COLUMN IF NOT EXISTS usuario_id      uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS recebe_comissao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacoes     text;

-- 2. Regras de comissão (uma linha por área que o funcionário recebe %)
CREATE TABLE IF NOT EXISTS public.comissao_regras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo           text NOT NULL,            -- área de negócio (banho_tosa, hotel, creche, veterinario, transporte...)
  percentual     numeric(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, tipo)
);

ALTER TABLE public.comissao_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comissao_regras_all" ON public.comissao_regras;
CREATE POLICY "comissao_regras_all" ON public.comissao_regras
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_comissao_regras_func ON public.comissao_regras(funcionario_id);

-- 3. Comissões pagas (uma por funcionário + mês de referência — impede pagar 2x)
CREATE TABLE IF NOT EXISTS public.comissoes_pagas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,            -- 'YYYY-MM'
  valor_total    numeric(12,2) NOT NULL,
  despesa_id     uuid REFERENCES public.despesas(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, mes_referencia)
);

ALTER TABLE public.comissoes_pagas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comissoes_pagas_all" ON public.comissoes_pagas;
CREATE POLICY "comissoes_pagas_all" ON public.comissoes_pagas
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_comissoes_pagas_func ON public.comissoes_pagas(funcionario_id);

-- 4. Vínculo executado_por nas receitas (quem fez o serviço → base do cálculo)
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS executado_por uuid REFERENCES public.funcionarios(id);

CREATE INDEX IF NOT EXISTS idx_receitas_executado_por ON public.receitas(executado_por);
