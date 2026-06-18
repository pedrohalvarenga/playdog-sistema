-- ============================================================
-- PLAY DOG — Correções da auditoria (banco)
-- Execute no Supabase SQL Editor
-- ============================================================

-- (2) Blindar consumo de crédito: nunca deixar saldo negativo.
CREATE OR REPLACE FUNCTION public.consumir_credito_banho(p_pet_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_saldo INTEGER;
BEGIN
  UPDATE public.pets
    SET saldo_banhos = saldo_banhos - 1
    WHERE id = p_pet_id AND COALESCE(saldo_banhos, 0) > 0
    RETURNING saldo_banhos INTO v_saldo;
  IF NOT FOUND THEN
    -- sem saldo: não desconta, retorna o saldo atual (0)
    SELECT COALESCE(saldo_banhos, 0) INTO v_saldo FROM public.pets WHERE id = p_pet_id;
  END IF;
  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (4) Funcionário banho_tosa pode registrar receitas do seu domínio
--     (serviço de banho e taxi dog), além de admin/recepção.
DROP POLICY IF EXISTS "receitas_insert" ON public.receitas;
CREATE POLICY "receitas_insert" ON public.receitas
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'recepcao')
    OR (public.get_my_role() = 'banho_tosa' AND area IN ('banho_tosa', 'transporte'))
  );

-- (7) Padronizar my_role() para também exigir usuário ativo
--     (fecha a brecha de usuário inativo acessar o Hotel).
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND ativo = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
