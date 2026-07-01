-- ============================================================
-- PLAY DOG — Comissões v2: regra escalonada + comissão por presença
-- Rode no Supabase → SQL Editor. Idempotente.
--
--  (1) comissao_regras ganha campos para:
--      - escalonamento por faturamento da área (ex.: 5% até 10k, 10% acima);
--      - comissão fixa por presença na creche (R$ por presença);
--      - data de início de vigência da regra.
--  (2) Regra da Bia (Beatriz): 5% em banho & tosa, virando 10% quando o
--      faturamento mensal de banho & tosa passar de R$ 10.000.
--  (3) Regra da Luiza (Maria Luiza): R$ 1,00 por presença na creche, a
--      partir de 01/07/2026.
-- ============================================================

ALTER TABLE public.comissao_regras
  ADD COLUMN IF NOT EXISTS tipo_calculo       text NOT NULL DEFAULT 'percentual'
      CHECK (tipo_calculo IN ('percentual','por_presenca_creche')),
  ADD COLUMN IF NOT EXISTS valor_fixo         numeric(12,2),   -- R$ por presença
  ADD COLUMN IF NOT EXISTS faturamento_limite numeric(12,2),   -- limite p/ escalonar
  ADD COLUMN IF NOT EXISTS percentual_acima   numeric(5,2),    -- % acima do limite
  ADD COLUMN IF NOT EXISTS vigencia_inicio    date;            -- vale a partir de

-- (2) Bia — Beatriz Rodrigues Cabral da Silva
INSERT INTO public.comissao_regras
  (funcionario_id, tipo, percentual, tipo_calculo, faturamento_limite, percentual_acima)
VALUES
  ('9a696ddd-7ba8-4f81-8559-bb235fde7888', 'banho_tosa', 5, 'percentual', 10000, 10)
ON CONFLICT (funcionario_id, tipo) DO UPDATE SET
  percentual         = EXCLUDED.percentual,
  tipo_calculo       = EXCLUDED.tipo_calculo,
  faturamento_limite = EXCLUDED.faturamento_limite,
  percentual_acima   = EXCLUDED.percentual_acima;

-- (3) Luiza — Maria Luiza Moreira Liota
UPDATE public.funcionarios SET recebe_comissao = true
  WHERE id = '2e869db4-5e1a-40ac-8e86-415c4f3a9d67';

INSERT INTO public.comissao_regras
  (funcionario_id, tipo, percentual, tipo_calculo, valor_fixo, vigencia_inicio)
VALUES
  ('2e869db4-5e1a-40ac-8e86-415c4f3a9d67', 'creche', 0, 'por_presenca_creche', 1.00, '2026-07-01')
ON CONFLICT (funcionario_id, tipo) DO UPDATE SET
  percentual      = EXCLUDED.percentual,
  tipo_calculo    = EXCLUDED.tipo_calculo,
  valor_fixo      = EXCLUDED.valor_fixo,
  vigencia_inicio = EXCLUDED.vigencia_inicio;

-- ============================================================
-- FIM
-- ============================================================
