-- Funcionários e pagamentos de salário (executado em 11/06/2026 via SQL Editor)
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text,
  salario numeric NOT NULL DEFAULT 0,
  dia_pagamento int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funcionarios_all" ON public.funcionarios;
CREATE POLICY "funcionarios_all" ON public.funcionarios
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Vínculo de pagamentos de salário com o funcionário e o mês de referência
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.funcionarios(id);
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS mes_referencia text;

-- Seed inicial
INSERT INTO public.funcionarios (nome, cargo, salario, dia_pagamento) VALUES
  ('Carol', 'Funcionária', 4000, 9),
  ('Mariana', 'Funcionária', 4000, 9);
