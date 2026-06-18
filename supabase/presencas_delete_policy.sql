-- ============================================================
-- PRESENCAS: permitir DELETE para admin e recepção
-- Necessário para "Desfazer check-in" e para a edição manual de
-- dias de presença (apagar um registro lançado em data errada).
-- Sem esta policy, o RLS bloqueia o DELETE silenciosamente.
-- ============================================================

DROP POLICY IF EXISTS "presencas_delete" ON public.presencas;

CREATE POLICY "presencas_delete" ON public.presencas
  FOR DELETE USING (public.get_my_role() IN ('admin', 'recepcao'));
