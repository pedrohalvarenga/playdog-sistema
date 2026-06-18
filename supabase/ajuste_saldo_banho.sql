-- ============================================================
-- PLAY DOG — Ajuste manual do saldo de banhos (pacote)
-- Espelha ajustes_saldo da creche. Execute no Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ajustes_saldo_banho (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  quantidade      INTEGER NOT NULL,
  motivo          TEXT NOT NULL,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_banho_pet ON public.ajustes_saldo_banho(pet_id);

ALTER TABLE public.ajustes_saldo_banho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_banho_select" ON public.ajustes_saldo_banho
  FOR SELECT USING (get_my_role() IN ('admin','recepcao'));

CREATE POLICY "ajustes_banho_insert" ON public.ajustes_saldo_banho
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao'));
